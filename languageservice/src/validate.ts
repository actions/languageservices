import {FeatureFlags, Lexer, Parser} from "@actions/expressions";
import {Expr} from "@actions/expressions/ast";
import {TemplateParseResult, WorkflowTemplate, isBasicExpression, isMapping, isString} from "@actions/workflow-parser";
import {ErrorPolicy} from "@actions/workflow-parser/model/convert";
import {getCronDescription, hasCronIntervalLessThan5Minutes} from "@actions/workflow-parser/model/converter/cron";
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
import {ActionMetadata, ActionReference} from "./action.js";
import {ContextProviderConfig} from "./context-providers/config.js";
import {Mode, getWorkflowExpressionContext} from "./context-providers/default.js";
import {WorkflowContext, getWorkflowContext} from "./context/workflow-context.js";
import {wrapDictionary} from "./expression-validation/error-dictionary.js";
import {ValidationEvaluator} from "./expression-validation/evaluator.js";
import {validatorFunctions} from "./expression-validation/functions.js";
import {error} from "./log.js";
import {isActionDocument} from "./utils/document-type.js";
import {findToken} from "./utils/find-token.js";
import {mapRange} from "./utils/range.js";
import {hasFormatWithLiteralText} from "./utils/validate-if.js";
import {validateStepUsesFormat, warnIfShortSha} from "./utils/validate-uses.js";
import {getOrConvertWorkflowTemplate, getOrParseWorkflow} from "./utils/workflow-cache.js";
import {validateActionReference} from "./validate-action-reference.js";
import {validateAction} from "./validate-action.js";
import {validateFormatCalls} from "./validate-format-string.js";
import {ValueProviderConfig, ValueProviderKind} from "./value-providers/config.js";
import {defaultValueProviders} from "./value-providers/default.js";

const CRON_SCHEDULE_DOCS_URL =
  "https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#onschedule";

export type ValidationConfig = {
  valueProviderConfig?: ValueProviderConfig;
  contextProviderConfig?: ContextProviderConfig;
  actionsMetadataProvider?: ActionsMetadataProvider;
  fileProvider?: FileProvider;
  featureFlags?: FeatureFlags;
};

export type ActionsMetadataProvider = {
  fetchActionMetadata(action: ActionReference): Promise<ActionMetadata | undefined>;
};

/**
 * Validates a workflow or action file
 *
 * @param textDocument Document to validate
 * @returns Array of diagnostics
 */
export async function validate(textDocument: TextDocument, config?: ValidationConfig): Promise<Diagnostic[]> {
  return isActionDocument(textDocument.uri)
    ? validateAction(textDocument, config)
    : validateWorkflow(textDocument, config);
}

/**
 * Validates a workflow file
 *
 * @param textDocument Document to validate
 * @returns Array of diagnostics
 */
async function validateWorkflow(textDocument: TextDocument, config?: ValidationConfig): Promise<Diagnostic[]> {
  const file: File = {
    name: textDocument.uri,
    content: textDocument.getText()
  };

  const diagnostics: Diagnostic[] = [];

  try {
    const result: TemplateParseResult | undefined = getOrParseWorkflow(file, textDocument.uri);
    if (!result) {
      return [];
    }

    if (result.value) {
      // Errors will be updated in the context. Attempt to do the conversion anyway in order to give the user more information
      const template = await getOrConvertWorkflowTemplate(result.context, result.value, textDocument.uri, config, {
        fetchReusableWorkflowDepth: config?.fileProvider ? 1 : 0,
        errorPolicy: ErrorPolicy.TryConversion
      });

      // Validate expressions and value providers
      await additionalValidations(diagnostics, textDocument.uri, template, result.value, config, config?.featureFlags);
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
  config?: ValidationConfig,
  featureFlags?: FeatureFlags
) {
  for (const [parent, token, key, ancestors] of TemplateToken.traverse(root)) {
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

    // Validate block scalar chomping for expressions and strings
    if (featureFlags?.isEnabled("blockScalarChompingWarning")) {
      validateBlockScalarChomping(diagnostics, token, parent, key, ancestors);
    }

    // `if` conditions allow omitting ${{ }}, so validate strings in these fields as expressions
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
          token.source,
          undefined,
          token.blockScalarHeader
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

    // Validate step uses field format
    if (isString(token) && token.range && validationDefinition?.key === "step-uses") {
      validateStepUsesFormat(diagnostics, token);
    }

    // Validate action metadata (inputs, required fields) for regular steps
    if (token.definition?.key === "regular-step" && token.range) {
      const context = getProviderContext(documentUri, template, root, token.range);
      await validateActionReference(diagnostics, token, context.step, config);
    }

    // Validate job-level reusable workflow uses field format
    if (
      isString(token) &&
      token.range &&
      key &&
      isString(key) &&
      key.value === "uses" &&
      parent?.definition?.key === "workflow-job"
    ) {
      validateWorkflowUsesFormat(diagnostics, token);
    }

    // Validate cron expressions - warn if interval is less than 5 minutes
    if (isString(token) && token.range && validationDefinition?.key === "cron-pattern") {
      validateCronExpression(diagnostics, token);
    }

    // Allowed values coming from the schema have already been validated. Only check if
    // a value provider is defined for a token and if it is, validate the values match.
    if (token.range && validationDefinition) {
      const defKey = validationDefinition.key;
      if (defKey === "step-with") {
        // Action inputs should be validated already in validateActionReference
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

  // Validate concurrency deadlock between workflow and job levels
  validateConcurrencyDeadlock(diagnostics, template);
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

/**
 * Validates cron expressions and provides diagnostics for valid cron schedules.
 * Shows a warning if the interval is less than 5 minutes (since GitHub Actions
 * schedules run at most every 5 minutes), otherwise shows an info message.
 */
function validateCronExpression(diagnostics: Diagnostic[], token: StringToken): void {
  const cronValue = token.value;

  // Ensure we have a range for diagnostics
  if (!token.range) {
    return;
  }

  // Only check valid cron expressions - invalid ones are already caught by the parser
  const description = getCronDescription(cronValue);
  if (!description) {
    return;
  }

  // Check if the cron specifies an interval less than 5 minutes
  if (hasCronIntervalLessThan5Minutes(cronValue)) {
    diagnostics.push({
      message: `Actions schedules run at most every 5 minutes. "${cronValue}" (${description.toLowerCase()}) will not run as frequently as specified.`,
      range: mapRange(token.range),
      severity: DiagnosticSeverity.Warning,
      code: "on-schedule",
      codeDescription: {
        href: CRON_SCHEDULE_DOCS_URL
      }
    });
  }
}

/**
 * Validates the format of a job's `uses` field (reusable workflow reference).
 *
 * Valid formats:
 * - {owner}/{repo}/.github/workflows/{filename}.yml@{ref}
 * - {owner}/{repo}/.github/workflows/{filename}.yaml@{ref}
 * - {owner}/{repo}/.github/workflows-lab/{filename}.yml@{ref}
 * - {owner}/{repo}/.github/workflows-lab/{filename}.yaml@{ref}
 * - ./.github/workflows/{filename}.yml
 * - ./.github/workflows/{filename}.yaml
 * - ./.github/workflows-lab/{filename}.yml
 * - ./.github/workflows-lab/{filename}.yaml
 */
function validateWorkflowUsesFormat(diagnostics: Diagnostic[], token: StringToken): void {
  const uses = token.value;

  // Local workflow reference
  if (uses.startsWith("./.github/workflows/") || uses.startsWith("./.github/workflows-lab/")) {
    // Cannot have @ version for local workflows
    if (uses.includes("@")) {
      addWorkflowUsesFormatError(diagnostics, token, "cannot specify version when calling local workflows");
      return;
    }

    // Must have .yml or .yaml extension
    if (!uses.endsWith(".yml") && !uses.endsWith(".yaml")) {
      addWorkflowUsesFormatError(
        diagnostics,
        token,
        "workflow file should have either a '.yml' or '.yaml' file extension"
      );
      return;
    }

    // Must be at top level of .github/workflows/ or .github/workflows-lab/ (no subdirectories)
    const pathParts = uses.split("/");
    if (pathParts.length !== 4) {
      // Expected: ".", ".github", "workflows" or "workflows-lab", "filename.yml"
      addWorkflowUsesFormatError(
        diagnostics,
        token,
        "workflows must be defined at the top level of the .github/workflows/ directory"
      );
      return;
    }

    // Filename cannot be just the extension
    const filename = pathParts[3];
    if (filename === ".yml" || filename === ".yaml") {
      addWorkflowUsesFormatError(diagnostics, token, "invalid workflow file name");
      return;
    }

    return;
  }

  // Malformed local workflow reference (starts with ./ but not in .github/workflows)
  if (uses.startsWith("./")) {
    addWorkflowUsesFormatError(diagnostics, token, "local workflow references must be rooted in '.github/workflows'");
    return;
  }

  // Remote workflow reference: must have @ for version
  const atSegments = uses.split("@");
  if (atSegments.length === 1) {
    addWorkflowUsesFormatError(diagnostics, token, "no version specified");
    return;
  }
  if (atSegments.length > 2) {
    addWorkflowUsesFormatError(diagnostics, token, "too many '@' in workflow reference");
    return;
  }

  const [pathPart, version] = atSegments;

  // Version cannot be empty
  if (!version) {
    addWorkflowUsesFormatError(diagnostics, token, "no version specified");
    return;
  }

  // Must contain .github/workflows or .github/workflows-lab path
  const workflowsMatch = pathPart.match(/\.github\/workflows(-lab)?\//);
  if (!workflowsMatch || workflowsMatch.index === undefined) {
    addWorkflowUsesFormatError(diagnostics, token, "references to workflows must be rooted in '.github/workflows'");
    return;
  }

  // Split to get owner/repo and path
  const pathIdx = workflowsMatch.index;
  const nwoPart = pathPart.substring(0, pathIdx);
  const workflowPath = pathPart.substring(pathIdx);

  // Validate NWO part: must be owner/repo/
  const nwoSegments = nwoPart.split("/").filter(s => s.length > 0);
  if (nwoSegments.length !== 2) {
    addWorkflowUsesFormatError(
      diagnostics,
      token,
      "references to workflows must be prefixed with format 'owner/repository/' or './' for local workflows"
    );
    return;
  }

  // Validate owner and repo names
  const [owner, repo] = nwoSegments;
  const nwoError = validateNWO(owner, repo);
  if (nwoError) {
    addWorkflowUsesFormatError(diagnostics, token, nwoError);
    return;
  }

  // Validate ref/version format
  const refError = validateRefName(version);
  if (refError) {
    addWorkflowUsesFormatError(diagnostics, token, refError);
    return;
  }

  // Validate workflow path is at top level
  const workflowPathParts = workflowPath.split("/");
  if (workflowPathParts.length !== 3) {
    // Expected: ".github", "workflows" or "workflows-lab", "filename.yml"
    addWorkflowUsesFormatError(
      diagnostics,
      token,
      "workflows must be defined at the top level of the .github/workflows/ directory"
    );
    return;
  }

  // Must have .yml or .yaml extension
  const filename = workflowPathParts[2];
  if (!filename.endsWith(".yml") && !filename.endsWith(".yaml")) {
    addWorkflowUsesFormatError(
      diagnostics,
      token,
      "workflow file should have either a '.yml' or '.yaml' file extension"
    );
    return;
  }

  // Filename cannot be just the extension
  if (filename === ".yml" || filename === ".yaml") {
    addWorkflowUsesFormatError(diagnostics, token, "invalid workflow file name");
    return;
  }

  // Warn if version looks like a short SHA
  warnIfShortSha(diagnostics, token, version);
}

function addWorkflowUsesFormatError(diagnostics: Diagnostic[], token: StringToken, reason: string): void {
  diagnostics.push({
    message: `Invalid workflow reference '${token.value}': ${reason}`,
    severity: DiagnosticSeverity.Error,
    range: mapRange(token.range),
    code: "invalid-workflow-uses-format"
  });
}

/**
 * Validates the git ref/version format.
 * Based on Launch's ValidateRefName function.
 */
function validateRefName(refname: string): string | undefined {
  if (refname.length === 0) {
    return "no version specified";
  }

  // Cannot be the single character '@'
  if (refname === "@") {
    return "version cannot be the single character '@'";
  }

  // Cannot have certain invalid characters or sequences
  const invalidSequences = ["?", "*", "[", "]", "\\", "~", "^", ":", "@{", "..", "//"];
  for (const seq of invalidSequences) {
    if (refname.includes(seq)) {
      return `invalid character '${seq}' in version`;
    }
  }

  // Cannot begin or end with a slash '/' or a dot '.'
  if (refname.startsWith("/") || refname.endsWith("/") || refname.startsWith(".") || refname.endsWith(".")) {
    return "version cannot begin or end with a slash '/' or a dot '.'";
  }

  // No slash-separated component can begin with a dot '.' or end with the sequence '.lock'
  const components = refname.split("/");
  for (const component of components) {
    if (component.startsWith(".") || component.endsWith(".lock")) {
      return `invalid version: ${refname}`;
    }
  }

  // No ASCII control characters or whitespace
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(refname)) {
    return "version cannot have ASCII control characters";
  }

  if (/\s/.test(refname)) {
    return "version cannot have whitespace";
  }

  return undefined;
}

/**
 * Validates owner and repository names.
 * Based on Launch's ValidateNWO function.
 */
function validateNWO(owner: string, repo: string): string | undefined {
  // Owner name: can have word chars, dots, and hyphens
  // \w in JS regex is [a-zA-Z0-9_]
  if (!/^[\w.-]+$/.test(owner)) {
    return "owner name must be a valid repository owner name";
  }

  // Repository name: can have word chars, dots, and hyphens
  if (!/^[\w.-]+$/.test(repo)) {
    return "repository name is invalid";
  }

  return undefined;
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
            "Conditional expression contains literal text outside replacement tokens. This will cause the expression to always evaluate to truthy. Did you mean to put the entire expression inside ${{ }}?",
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

    // Validate format() function calls
    const formatErrors = validateFormatCalls(expr);
    for (const formatError of formatErrors) {
      if (formatError.type === "invalid-syntax") {
        diagnostics.push({
          message: `Invalid format string: ${formatError.message}`,
          range: mapRange(expression.range),
          severity: DiagnosticSeverity.Error,
          code: "invalid-format-string"
        });
      } else if (formatError.type === "arg-count-mismatch") {
        diagnostics.push({
          message: `Format string references argument {${formatError.expected - 1}} but only ${
            formatError.provided
          } argument(s) provided`,
          range: mapRange(expression.range),
          severity: DiagnosticSeverity.Error,
          code: "format-arg-count-mismatch"
        });
      }
    }

    const context = await getWorkflowExpressionContext(
      namedContexts,
      contextProviderConfig,
      workflowContext,
      Mode.Validation
    );

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

/**
 * Validates that workflow-level and job-level concurrency groups don't match,
 * which would cause a deadlock at runtime.
 */
function validateConcurrencyDeadlock(diagnostics: Diagnostic[], template: WorkflowTemplate): void {
  const workflowGroup = getStaticConcurrencyGroup(template.concurrency);
  if (!workflowGroup) {
    return; // No workflow-level concurrency or it's an expression
  }

  for (const job of template.jobs || []) {
    if (!job.concurrency) {
      continue;
    }

    const jobGroup = getStaticConcurrencyGroup(job.concurrency);
    if (!jobGroup) {
      continue; // Job concurrency is an expression
    }

    if (workflowGroup.value === jobGroup.value) {
      // Error on workflow-level concurrency
      if (template.concurrency.range) {
        diagnostics.push({
          message: `Concurrency group '${workflowGroup.value}' is also used by job '${job.id.value}'. This will cause a deadlock.`,
          range: mapRange(template.concurrency.range),
          severity: DiagnosticSeverity.Error
        });
      }

      // Error on job-level concurrency
      if (job.concurrency.range) {
        diagnostics.push({
          message: `Concurrency group '${jobGroup.value}' is also defined at the workflow level. This will cause a deadlock.`,
          range: mapRange(job.concurrency.range),
          severity: DiagnosticSeverity.Error
        });
      }
    }
  }
}

/**
 * Extracts the static concurrency group name from a concurrency token.
 * Returns undefined if the token is an expression or doesn't have a static group.
 */
function getStaticConcurrencyGroup(token: TemplateToken | undefined): StringToken | undefined {
  if (!token || token.isExpression) {
    return undefined;
  }

  // Simple string form: concurrency: "test"
  if (isString(token)) {
    return token;
  }

  // Mapping form: concurrency: { group: "test", cancel-in-progress: true }
  if (isMapping(token)) {
    for (const pair of token) {
      if (isString(pair.key) && pair.key.value === "group" && isString(pair.value) && !pair.value.isExpression) {
        return pair.value;
      }
    }
  }

  return undefined;
}

/**
 * Validates YAML block scalar chomping.
 *
 * Block scalars (| and >) implicitly add a trailing newline by default ("clip" chomping).
 * This is often unintended by the workflow author and can cause unexpected behavior.
 * This function warns on certain fields when clip chomping is used (implicit trailing newline)
 * and suggests they explicitly use strip (|-) or keep (|+) to clarify intent.
 *
 * Only specific fields are validated - those where trailing newlines may cause
 * issues but aren't automatically trimmed server-side. For example env, inputs, outputs, etc.
 *
 * Skipped fields:
 * - run: Multi-line scripts commonly have trailing newlines
 * - Fields trimmed server-side: name, uses, shell, if, etc.
 */
function validateBlockScalarChomping(
  diagnostics: Diagnostic[],
  token: TemplateToken,
  parent: TemplateToken | undefined,
  key: TemplateToken | undefined,
  ancestors: TemplateToken[]
): void {
  // Not an expression or string?
  if (!isBasicExpression(token) && !isString(token)) {
    return;
  }

  // Not a block scalar?
  const header = token.blockScalarHeader;
  if (!header) {
    return;
  }

  // Not "clip" chomp style?
  if (header.includes("+") || header.includes("-")) {
    return;
  }

  // Check if we should warn
  let shouldWarn = false;
  const parentDefinitionName = parent?.definition?.key;
  const tokenDefinitionName = token.definition?.key;
  const keyName = key && isString(key) ? key.value : undefined;
  if (
    parentDefinitionName &&
    [
      "workflow-env",
      "job-env",
      "step-env",
      "container-env",
      "step-with",
      "job-outputs",
      "workflow-job-with",
      "workflow-job-secrets"
    ].includes(parentDefinitionName)
  ) {
    // env, with, outputs, or secrets fields
    shouldWarn = true;
  } else if (
    ancestors.some(ancestor => {
      const ancestorKey = ancestor.definition?.key;
      return ancestorKey === "matrix" || ancestorKey === "matrix-filter" || ancestorKey === "matrix-filter-item";
    })
  ) {
    // Matrix values (vectors, include, exclude)
    shouldWarn = true;
  } else if (tokenDefinitionName && ["workflow-concurrency", "job-concurrency"].includes(tokenDefinitionName)) {
    // Concurrency shorthand
    shouldWarn = true;
  } else if (keyName === "group" && parentDefinitionName === "concurrency-mapping") {
    // Concurrency group field
    shouldWarn = true;
  }

  if (!shouldWarn) {
    return;
  }

  const blockIndicator = header.startsWith("|") ? "|" : ">";
  diagnostics.push({
    message: `Block scalar '${blockIndicator}' implicitly adds a trailing newline that may be unintentional. Use '${blockIndicator}-' to remove it, or '${blockIndicator}+' to explicitly keep it.`,
    range: mapRange(token.range),
    severity: DiagnosticSeverity.Warning,
    code: "block-scalar-chomping"
  });
}
