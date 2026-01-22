/**
 * Validation for action.yml / action.yaml manifest files
 */

import {Lexer, Parser} from "@actions/expressions";
import {Expr} from "@actions/expressions/ast";
import {isBasicExpression, isMapping, isString} from "@actions/workflow-parser";
import {isActionStep} from "@actions/workflow-parser/model/type-guards";
import {ErrorPolicy} from "@actions/workflow-parser/model/convert";
import {ensureStatusFunction} from "@actions/workflow-parser/model/converter/if-condition";
import {splitAllowedContext} from "@actions/workflow-parser/templates/allowed-context";
import {BasicExpressionToken} from "@actions/workflow-parser/templates/tokens/basic-expression-token";
import {MappingToken} from "@actions/workflow-parser/templates/tokens/mapping-token";
import {SequenceToken} from "@actions/workflow-parser/templates/tokens/sequence-token";
import {StringToken} from "@actions/workflow-parser/templates/tokens/string-token";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";
import {TokenRange} from "@actions/workflow-parser/templates/tokens/token-range";
import {TemplateValidationError} from "@actions/workflow-parser/templates/template-validation-error";
import {File} from "@actions/workflow-parser/workflows/file";
import {TextDocument} from "vscode-languageserver-textdocument";
import {Diagnostic, DiagnosticSeverity} from "vscode-languageserver-types";
import {error} from "./log.js";
import {mapRange} from "./utils/range.js";
import {hasFormatWithLiteralText} from "./utils/validate-if.js";
import {validateStepUsesFormat} from "./utils/validate-uses.js";
import {getOrConvertActionTemplate, getOrParseAction} from "./utils/workflow-cache.js";
import {validateActionReference} from "./validate-action-reference.js";
import {validateFormatCalls} from "./validate-format-string.js";
import {ValidationConfig} from "./validate.js";

/**
 * Valid keys for each action type under the `runs:` section.
 * Source: https://github.com/actions/runner/blob/main/src/Runner.Worker/ActionManifestManager.cs
 */
const NODE_KEYS = new Set(["using", "main", "pre", "post", "pre-if", "post-if"]);
const COMPOSITE_KEYS = new Set(["using", "steps"]);
const DOCKER_KEYS = new Set([
  "using",
  "image",
  "args",
  "env",
  "entrypoint",
  "pre-entrypoint",
  "pre-if",
  "post-entrypoint",
  "post-if"
]);

/**
 * Required keys for each action type (besides 'using').
 */
const NODE_REQUIRED_KEYS = ["main"];
const COMPOSITE_REQUIRED_KEYS = ["steps"];
const DOCKER_REQUIRED_KEYS = ["image"];

/**
 * Validates an action.yml file
 *
 * @param textDocument Document to validate
 * @param config Optional validation configuration for action metadata provider
 * @returns Array of diagnostics
 */
export async function validateAction(textDocument: TextDocument, config?: ValidationConfig): Promise<Diagnostic[]> {
  const file: File = {
    name: textDocument.uri,
    content: textDocument.getText()
  };

  const diagnostics: Diagnostic[] = [];

  try {
    // Parse and validate the action.yml against the schema
    const result = getOrParseAction(file, textDocument.uri);
    if (!result) {
      return [];
    }

    // Get schema errors
    const schemaErrors = result.context.errors.getErrors();

    // Run custom runs key validation, which also filters redundant schema errors in place
    if (result.value) {
      diagnostics.push(...validateRunsKeysAndFilterErrors(result.value, schemaErrors));
    }

    // Map remaining schema errors to diagnostics
    for (const err of schemaErrors) {
      const range = mapRange(err.range);

      // Determine severity based on error type
      let severity: DiagnosticSeverity = DiagnosticSeverity.Error;

      // Treat deprecation warnings as warnings
      if (err.rawMessage.includes("deprecated")) {
        severity = DiagnosticSeverity.Warning;
      }

      diagnostics.push({
        message: err.rawMessage,
        range,
        severity
      });
    }

    // Validate composite action steps if we have a parsed result
    if (result.value) {
      const template = getOrConvertActionTemplate(result.context, result.value, textDocument.uri, {
        errorPolicy: ErrorPolicy.TryConversion
      });

      // Only composite actions have steps to validate
      if (template?.runs?.using === "composite") {
        const steps = template.runs.steps ?? [];

        // Find the steps sequence token from the raw parsed result
        const stepsSequence = findStepsSequence(result.value);
        if (stepsSequence) {
          // Validate each action step
          for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const stepToken = stepsSequence.get(i);

            // Validate action references (inputs, required fields) for uses steps
            if (isActionStep(step) && isMapping(stepToken)) {
              await validateActionReference(diagnostics, stepToken, step, config);
            }

            // Validate step tokens (uses format, if conditions)
            if (isMapping(stepToken)) {
              validateCompositeStepTokens(diagnostics, stepToken);
            }
          }
        }
      }

      // Validate pre-if and post-if for node and docker actions
      const runsMapping = findRunsMapping(result.value);
      if (runsMapping) {
        validateRunsIfConditions(diagnostics, runsMapping);
      }

      // Validate format() calls in all expressions throughout the action
      validateAllExpressions(diagnostics, result.value);
    }
  } catch (e) {
    error(`Unhandled error while validating action file: ${(e as Error).message}`);
  }

  return diagnostics;
}

/**
 * Validates tokens within a composite action step.
 * Checks `uses` format and `if` literal text detection.
 */
function validateCompositeStepTokens(diagnostics: Diagnostic[], stepToken: MappingToken): void {
  for (let i = 0; i < stepToken.count; i++) {
    const {key, value} = stepToken.get(i);
    const keyStr = isString(key) ? key.value.toLowerCase() : "";

    // Validate `uses` field format
    if (keyStr === "uses" && isString(value)) {
      validateStepUsesFormat(diagnostics, value);
    }

    // Validate `if` field for literal text outside expressions
    if (keyStr === "if" && value.range) {
      if (isString(value)) {
        // Plain string if condition (no ${{ }} markers)
        validateIfCondition(diagnostics, value);
      } else if (isBasicExpression(value)) {
        // Expression token - check for format() with literal text
        // This happens when the parser converts "push == ${{ expr }}" to format('push == {0}', expr)
        validateIfConditionExpression(diagnostics, value);
      }
    }
  }
}

/**
 * Validates an `if` condition (StringToken).
 * Checks for literal text outside expressions and validates format() calls.
 */
function validateIfCondition(diagnostics: Diagnostic[], token: StringToken): void {
  const condition = token.value.trim();
  if (!condition) {
    return;
  }

  // Get allowed context for step-if from the token's definition
  const allowedContext = token.definitionInfo?.allowedContext || [];
  const {namedContexts, functions} = splitAllowedContext(allowedContext);

  // Ensure the condition has a status function, wrapping if needed
  const finalCondition = ensureStatusFunction(condition, token.definitionInfo);

  // Create a BasicExpressionToken for validation
  const expressionToken = new BasicExpressionToken(
    token.file,
    token.range,
    finalCondition,
    token.definitionInfo,
    undefined,
    token.source,
    undefined,
    token.blockScalarHeader
  );

  // Check for literal text in the expression (format with literal text)
  try {
    const l = new Lexer(expressionToken.expression);
    const lr = l.lex();
    const p = new Parser(lr.tokens, namedContexts, functions);
    const expr = p.parse();

    if (hasFormatWithLiteralText(expr)) {
      diagnostics.push({
        message:
          "Conditional expression contains literal text outside replacement tokens. This will cause the expression to always evaluate to truthy. Did you mean to put the entire expression inside ${{ }}?",
        range: mapRange(token.range),
        severity: DiagnosticSeverity.Error,
        code: "expression-literal-text-in-condition"
      });
    }

    // Validate format() function calls
    validateFormatCallsAndAddDiagnostics(diagnostics, expr, token.range);
  } catch {
    // Ignore parse errors here - they'll be caught by schema validation
  }
}

/**
 * Validates an `if` condition (BasicExpressionToken).
 * Checks for literal text outside expressions.
 * Called when the parser has converted "push == ${{ expr }}" to format('push == {0}', expr).
 * Note: format() validation is handled by validateAllExpressions for BasicExpressionTokens.
 */
function validateIfConditionExpression(diagnostics: Diagnostic[], token: BasicExpressionToken): void {
  const allowedContext = token.definitionInfo?.allowedContext || [];
  const {namedContexts, functions} = splitAllowedContext(allowedContext);

  try {
    const l = new Lexer(token.expression);
    const lr = l.lex();
    const p = new Parser(lr.tokens, namedContexts, functions);
    const expr = p.parse();

    if (hasFormatWithLiteralText(expr)) {
      diagnostics.push({
        message:
          "Conditional expression contains literal text outside replacement tokens. This will cause the expression to always evaluate to truthy. Did you mean to put the entire expression inside ${{ }}?",
        range: mapRange(token.range),
        severity: DiagnosticSeverity.Error,
        code: "expression-literal-text-in-condition"
      });
    }
    // Note: format() validation is done by validateAllExpressions() for all BasicExpressionTokens
  } catch {
    // Ignore parse errors here - they'll be caught by schema validation
  }
}

/**
 * Helper to validate format() function calls and add diagnostics.
 */
function validateFormatCallsAndAddDiagnostics(
  diagnostics: Diagnostic[],
  expr: Expr,
  range: TokenRange | undefined
): void {
  const formatErrors = validateFormatCalls(expr);
  for (const formatError of formatErrors) {
    if (formatError.type === "invalid-syntax") {
      diagnostics.push({
        message: `Invalid format string: ${formatError.message}`,
        range: mapRange(range),
        severity: DiagnosticSeverity.Error,
        code: "invalid-format-string"
      });
    } else if (formatError.type === "arg-count-mismatch") {
      diagnostics.push({
        message: `Format string references argument {${formatError.expected - 1}} but only ${
          formatError.provided
        } argument(s) provided`,
        range: mapRange(range),
        severity: DiagnosticSeverity.Error,
        code: "format-arg-count-mismatch"
      });
    }
  }
}

/**
 * Find the steps sequence token from the raw action template.
 * Traverses the token tree looking for the "composite-steps" definition.
 */
function findStepsSequence(root: TemplateToken): SequenceToken | undefined {
  for (const [, token] of TemplateToken.traverse(root)) {
    if (token.definition?.key === "composite-steps" && token instanceof SequenceToken) {
      return token;
    }
  }
  return undefined;
}

/**
 * Find the runs mapping token from the raw action template.
 */
function findRunsMapping(root: TemplateToken): MappingToken | undefined {
  if (root instanceof MappingToken) {
    for (let i = 0; i < root.count; i++) {
      const {key, value} = root.get(i);
      if (key.toString().toLowerCase() === "runs" && value instanceof MappingToken) {
        return value;
      }
    }
  }
  return undefined;
}

/**
 * Validates pre-if and post-if conditions at the runs level (for node and docker actions).
 * Checks for literal text outside expressions that would always be truthy.
 */
function validateRunsIfConditions(diagnostics: Diagnostic[], runsMapping: MappingToken): void {
  for (let i = 0; i < runsMapping.count; i++) {
    const {key, value} = runsMapping.get(i);
    const keyStr = key.toString().toLowerCase();

    // Validate pre-if and post-if fields for literal text
    if ((keyStr === "pre-if" || keyStr === "post-if") && value.range) {
      if (isString(value)) {
        // Plain string condition (no ${{ }} markers)
        validateIfCondition(diagnostics, value);
      } else if (isBasicExpression(value)) {
        // The runner doesn't support explicit ${{ }} syntax for pre-if/post-if
        // Only implicit expressions are allowed
        diagnostics.push({
          message: `Explicit expression syntax \${{ }} is not supported for '${keyStr}'. Remove the \${{ }} markers and use the expression directly.`,
          range: mapRange(value.range),
          severity: DiagnosticSeverity.Error,
          code: "explicit-expression-not-allowed"
        });
      }
    }
  }
}

/**
 * Validates format() function calls in all expressions throughout the action template.
 * This catches format string errors in any expression, not just if conditions.
 */
function validateAllExpressions(diagnostics: Diagnostic[], root: TemplateToken): void {
  for (const [, token] of TemplateToken.traverse(root)) {
    if (token instanceof BasicExpressionToken) {
      // Process original expressions if available (for combined expressions like "${{ a }} text ${{ b }}")
      // This ensures error ranges point to the correct original expression location
      for (const expression of token.originalExpressions || [token]) {
        const allowedContext = expression.definitionInfo?.allowedContext || [];
        const {namedContexts, functions} = splitAllowedContext(allowedContext);

        try {
          const l = new Lexer(expression.expression);
          const lr = l.lex();
          const p = new Parser(lr.tokens, namedContexts, functions);
          const expr = p.parse();

          validateFormatCallsAndAddDiagnostics(diagnostics, expr, expression.range);
        } catch {
          // Ignore parse errors - they'll be caught by schema validation
        }
      }
    }
  }
}

/**
 * Validates that the keys under `runs:` are valid for the specified `using:` type.
 * Also filters out schema errors (in place) that this validation replaces with more specific messages.
 */
function validateRunsKeysAndFilterErrors(
  root: TemplateToken,
  schemaErrors: TemplateValidationError[] // mutated: redundant errors are removed
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Find the runs mapping from the root
  let runsMapping: MappingToken | undefined;
  if (root instanceof MappingToken) {
    for (let i = 0; i < root.count; i++) {
      const {key, value} = root.get(i);
      if (key.toString().toLowerCase() === "runs" && value instanceof MappingToken) {
        runsMapping = value;
        break;
      }
    }
  }
  if (!runsMapping) {
    return diagnostics;
  }

  // Get the using value from the runs mapping
  let usingValue: string | undefined;
  for (let i = 0; i < runsMapping.count; i++) {
    const {key, value} = runsMapping.get(i);
    if (key.toString().toLowerCase() === "using") {
      usingValue = value.toString();
      break;
    }
  }
  if (!usingValue) {
    return diagnostics; // No using value, let schema validation handle it
  }

  // Determine allowed keys, required keys, and action type name
  let allowedKeys: Set<string>;
  let requiredKeys: string[];
  let actionType: string;

  if (usingValue.match(/^node\d+$/i)) {
    allowedKeys = NODE_KEYS;
    requiredKeys = NODE_REQUIRED_KEYS;
    actionType = "Node.js";
  } else if (usingValue.toLowerCase() === "composite") {
    allowedKeys = COMPOSITE_KEYS;
    requiredKeys = COMPOSITE_REQUIRED_KEYS;
    actionType = "composite";
  } else if (usingValue.toLowerCase() === "docker") {
    allowedKeys = DOCKER_KEYS;
    requiredKeys = DOCKER_REQUIRED_KEYS;
    actionType = "Docker";
  } else {
    return diagnostics; // Unknown type, let schema validation handle it
  }

  // Get all present keys
  const presentKeys = new Set<string>();
  for (let i = 0; i < runsMapping.count; i++) {
    const {key} = runsMapping.get(i);
    presentKeys.add(key.toString().toLowerCase());
  }

  // Check for invalid keys
  for (let i = 0; i < runsMapping.count; i++) {
    const {key} = runsMapping.get(i);
    const keyStr = key.toString().toLowerCase();

    if (!allowedKeys.has(keyStr)) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: mapRange(key.range),
        message: `'${key.toString()}' is not valid for ${actionType} actions (using: ${usingValue})`
      });
    }
  }

  // Check for missing required keys
  for (const requiredKey of requiredKeys) {
    if (!presentKeys.has(requiredKey)) {
      // Find the 'using' key to report the error location
      let usingKeyRange = runsMapping.range;
      for (let i = 0; i < runsMapping.count; i++) {
        const {key} = runsMapping.get(i);
        if (key.toString().toLowerCase() === "using") {
          usingKeyRange = key.range;
          break;
        }
      }

      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: mapRange(usingKeyRange),
        message: `'${requiredKey}' is required for ${actionType} actions (using: ${usingValue})`
      });
    }
  }

  // Remove schema errors that we're replacing with more specific messages (mutate in place)
  for (let i = schemaErrors.length - 1; i >= 0; i--) {
    const err = schemaErrors[i];

    // Keep errors not at the runs section start
    if (
      err.range?.start.line !== runsMapping.range?.start.line ||
      err.range?.start.column !== runsMapping.range?.start.column
    ) {
      continue;
    }

    // Check if this is an error we're replacing
    const isOneOfAmbiguity = err.rawMessage.startsWith("There's not enough info to determine");
    const isRequiredKey = /^Required property is missing: (main|steps|image)$/.test(err.rawMessage);

    if (!isOneOfAmbiguity && !isRequiredKey) {
      continue; // Keep errors we're not replacing
    }

    // Remove only if we have custom diagnostics for this
    if (diagnostics.length > 0) {
      schemaErrors.splice(i, 1);
    }
  }

  return diagnostics;
}
