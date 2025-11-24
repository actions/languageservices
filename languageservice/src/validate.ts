import {Lexer, Parser, data} from "@actions/expressions";
import {Expr, FunctionCall, Literal, Logical} from "@actions/expressions/ast";
import {ParseWorkflowResult, WorkflowTemplate, isBasicExpression, isString} from "@actions/workflow-parser";
import {ErrorPolicy} from "@actions/workflow-parser/model/convert";
import {ensureStatusFunction} from "@actions/workflow-parser/model/converter/if-condition";
import {splitAllowedContext} from "@actions/workflow-parser/templates/allowed-context";
import {BasicExpressionToken} from "@actions/workflow-parser/templates/tokens/basic-expression-token";
import {StringToken} from "@actions/workflow-parser/templates/tokens/string-token";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";
import {TokenRange} from "@actions/workflow-parser/templates/tokens/token-range";
import {File} from "@actions/workflow-parser/workflows/file";
import {FileProvider} from "@actions/workflow-parser/workflows/file-provider";
import {TextDocument} from "vscode-languageserver-textdocument";
import {Diagnostic, DiagnosticSeverity, URI} from "vscode-languageserver-types";
import {ActionMetadata, ActionReference} from "./action";
import {ContextProviderConfig} from "./context-providers/config";
import {Mode, getContext} from "./context-providers/default";
import {WorkflowContext, getWorkflowContext} from "./context/workflow-context";
import {wrapDictionary} from "./expression-validation/error-dictionary";
import {ValidationEvaluator} from "./expression-validation/evaluator";
import {validatorFunctions} from "./expression-validation/functions";
import {error} from "./log";
import {findToken} from "./utils/find-token";
import {mapRange} from "./utils/range";
import {fetchOrConvertWorkflowTemplate, fetchOrParseWorkflow} from "./utils/workflow-cache";
import {validateAction} from "./validate-action";
import {ValueProviderConfig, ValueProviderKind} from "./value-providers/config";
import {defaultValueProviders} from "./value-providers/default";

export type ValidationConfig = {
  valueProviderConfig?: ValueProviderConfig;
  contextProviderConfig?: ContextProviderConfig;
  actionsMetadataProvider?: ActionsMetadataProvider;
  fileProvider?: FileProvider;
};

export type ActionsMetadataProvider = {
  fetchActionMetadata(action: ActionReference): Promise<ActionMetadata | undefined>;
};

/**
 * Validates a workflow file
 *
 * @param textDocument Document to validate
 * @returns Array of diagnostics
 */
export async function validate(textDocument: TextDocument, config?: ValidationConfig): Promise<Diagnostic[]> {
  const file: File = {
    name: textDocument.uri,
    content: textDocument.getText()
  };

  const diagnostics: Diagnostic[] = [];

  try {
    const result: ParseWorkflowResult | undefined = fetchOrParseWorkflow(file, textDocument.uri);
    if (!result) {
      return [];
    }

    if (result.value) {
      // Errors will be updated in the context. Attempt to do the conversion anyway in order to give the user more information
      const template = await fetchOrConvertWorkflowTemplate(result.context, result.value, textDocument.uri, config, {
        fetchReusableWorkflowDepth: config?.fileProvider ? 1 : 0,
        errorPolicy: ErrorPolicy.TryConversion
      });

      // Validate expressions and value providers
      await additionalValidations(diagnostics, textDocument.uri, template, result.value, config);
    }

    // For now map parser errors directly to diagnostics
    for (const error of result.context.errors.getErrors()) {
      const range = mapRange(error.range);

      diagnostics.push({
        message: error.rawMessage,
        range
      });
    }
  } catch (e) {
    error(`Unhandled error while validating: ${(e as Error).message}`);
  }

  return diagnostics;
}

async function additionalValidations(
  diagnostics: Diagnostic[],
  documentUri: URI,
  template: WorkflowTemplate,
  root: TemplateToken,
  config?: ValidationConfig
) {
  for (const [parent, token, key] of TemplateToken.traverse(root)) {
    // If  the token is a value in a pair, use the key definition for validation
    // If the token has a parent (map, sequence, etc), use this definition for validation
    const validationToken = key || parent || token;
    const validationDefinition = validationToken.definition;

    // If this is an expression, validate it
    if (isBasicExpression(token) && token.range) {
      await validateExpression(
        diagnostics,
        token,
        validationToken.definitionInfo?.allowedContext || [],
        config?.contextProviderConfig,
        getProviderContext(documentUri, template, root, token.range),
        key?.definition?.key
      );
    }

    // If this is a job-if, step-if, or snapshot-if field (which are strings that should be treated as expressions), validate it
    const definitionKey = token.definition?.key;
    if (
      isString(token) &&
      token.range &&
      (definitionKey === "job-if" || definitionKey === "step-if" || definitionKey === "snapshot-if")
    ) {
      // Convert the string to an expression token for validation
      const condition = token.value.trim();
      if (condition) {
        // Ensure the condition has a status function, wrapping if needed
        const finalCondition = ensureStatusFunction(condition, token.definitionInfo);

        // Create a BasicExpressionToken for validation
        const expressionToken = new BasicExpressionToken(
          token.file,
          token.range,
          finalCondition,
          token.definitionInfo,
          undefined,
          token.source
        );

        await validateExpression(
          diagnostics,
          expressionToken,
          validationToken.definitionInfo?.allowedContext || [],
          config?.contextProviderConfig,
          getProviderContext(documentUri, template, root, token.range)
        );
      }
    }

    if (token.definition?.key === "regular-step" && token.range) {
      const context = getProviderContext(documentUri, template, root, token.range);
      await validateAction(diagnostics, token, context.step, config);
    }

    // Allowed values coming from the schema have already been validated. Only check if
    // a value provider is defined for a token and if it is, validate the values match.
    if (token.range && validationDefinition) {
      const defKey = validationDefinition.key;
      if (defKey === "step-with") {
        // Action inputs should be validated already in validateAction
        continue;
      }

      if (defKey === "workflow-job-with") {
        // Reusable workflow job inputs are validated by the parser
        continue;
      }

      // Try a custom value provider first
      let valueProvider = config?.valueProviderConfig?.[defKey];
      if (!valueProvider) {
        // fall back to default
        valueProvider = defaultValueProviders[defKey];
      }

      if (valueProvider) {
        const customValues = await valueProvider.get(getProviderContext(documentUri, template, root, token.range));
        const caseInsensitive = valueProvider.caseInsensitive ?? false;
        const customValuesMap = new Set(customValues.map(x => (caseInsensitive ? x.label.toLowerCase() : x.label)));

        if (isString(token)) {
          if (!customValuesMap.has(caseInsensitive ? token.value.toLowerCase() : token.value)) {
            invalidValue(diagnostics, token, valueProvider.kind);
          }
        }
      }
    }
  }
}

function invalidValue(diagnostics: Diagnostic[], token: StringToken, kind: ValueProviderKind) {
  switch (kind) {
    case ValueProviderKind.AllowedValues:
      diagnostics.push({
        message: `Value '${token.value}' is not valid`,
        severity: DiagnosticSeverity.Error,
        range: mapRange(token.range)
      });
      break;

    // no messages for SuggestedValues
  }
}

function getProviderContext(
  documentUri: URI,
  template: WorkflowTemplate,
  root: TemplateToken,
  tokenRange: TokenRange
): WorkflowContext {
  const {path} = findToken(
    {
      line: tokenRange.start.line - 1,
      character: tokenRange.start.column - 1
    },
    root
  );
  return getWorkflowContext(documentUri, template, path);
}

/**
 * Checks if a format function contains literal text in its format string.
 * This indicates user confusion about how expressions work.
 *
 * Example: format('push == {0}', github.event_name)
 * The literal text "push == " will always evaluate to truthy.
 *
 * @param expr The expression to check
 * @returns true if the expression is a format() call with literal text
 */
function hasFormatWithLiteralText(expr: Expr): boolean {
  // If this is a logical AND expression (from ensureStatusFunction wrapping)
  // check the right side for the format call
  if (expr instanceof Logical && expr.operator.lexeme === "&&" && expr.args.length === 2) {
    return hasFormatWithLiteralText(expr.args[1]);
  }

  if (!(expr instanceof FunctionCall)) {
    return false;
  }

  // Check if this is a format function
  if (expr.functionName.lexeme.toLowerCase() !== "format") {
    return false;
  }

  // Check if the first argument is a string literal
  if (expr.args.length < 1) {
    return false;
  }

  const firstArg = expr.args[0];
  if (!(firstArg instanceof Literal) || firstArg.literal.kind !== data.Kind.String) {
    return false;
  }

  // Get the format string and trim whitespace
  const formatString = firstArg.literal.coerceString();
  const trimmed = formatString.trim();

  // Check if there's literal text (non-replacement tokens) after trimming
  let inToken = false;
  for (let i = 0; i < trimmed.length; i++) {
    if (!inToken && trimmed[i] === "{") {
      inToken = true;
    } else if (inToken && trimmed[i] === "}") {
      inToken = false;
    } else if (inToken && trimmed[i] >= "0" && trimmed[i] <= "9") {
      // OK - this is a replacement token like {0}, {1}, etc.
    } else {
      // Found literal text
      return true;
    }
  }

  return false;
}

async function validateExpression(
  diagnostics: Diagnostic[],
  token: BasicExpressionToken,
  allowedContext: string[],
  contextProviderConfig: ContextProviderConfig | undefined,
  workflowContext: WorkflowContext,
  keyDefinitionKey?: string
) {
  const {namedContexts, functions} = splitAllowedContext(allowedContext);

  // Check for literal text in if condition
  const definitionKey = keyDefinitionKey || token.definitionInfo?.definition?.key;
  if (definitionKey === "job-if" || definitionKey === "step-if" || definitionKey === "snapshot-if") {
    try {
      const l = new Lexer(token.expression);
      const lr = l.lex();
      const p = new Parser(lr.tokens, namedContexts, functions);
      const expr = p.parse();

      if (hasFormatWithLiteralText(expr)) {
        diagnostics.push({
          message:
            "Conditional expression contains literal text outside replacement tokens. The will cause the expression to always evaluate to truthy. Did you mean to put the entire expression inside ${{ }}?",
          range: mapRange(token.range),
          severity: DiagnosticSeverity.Error,
          code: "expression-literal-text-in-condition"
        });
      }
    } catch {
      // Ignore parse errors here
    }
  }

  // Validate the expression
  for (const expression of token.originalExpressions || [token]) {
    let expr: Expr | undefined;

    try {
      const l = new Lexer(expression.expression);
      const lr = l.lex();

      const p = new Parser(lr.tokens, namedContexts, functions);
      expr = p.parse();
    } catch {
      // Ignore any error here, we should've caught this earlier in the parsing process
      continue;
    }

    const context = await getContext(namedContexts, contextProviderConfig, workflowContext, Mode.Validation);

    const e = new ValidationEvaluator(expr, wrapDictionary(context), validatorFunctions);
    e.validate();

    diagnostics.push(
      ...e.errors.map(e => ({
        message: e.message,
        range: mapRange(expression.range),
        severity: e.severity === "error" ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning
      }))
    );
  }
}
