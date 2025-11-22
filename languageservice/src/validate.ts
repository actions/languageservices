import {Lexer, Parser} from "@actions/expressions";
import {Expr} from "@actions/expressions/ast";
import {ParseWorkflowResult, WorkflowTemplate, isBasicExpression, isString} from "@actions/workflow-parser";
import {ErrorPolicy} from "@actions/workflow-parser/model/convert";
import {splitAllowedContext} from "@actions/workflow-parser/templates/allowed-context";
import {Definition} from "@actions/workflow-parser/templates/schema/definition";
import {BasicExpressionToken} from "@actions/workflow-parser/templates/tokens/basic-expression-token";
import {StringToken} from "@actions/workflow-parser/templates/tokens/string-token";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";
import {TokenRange} from "@actions/workflow-parser/templates/tokens/token-range";
import {File} from "@actions/workflow-parser/workflows/file";
import {FileProvider} from "@actions/workflow-parser/workflows/file-provider";
import {Scalar} from "yaml";
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
        getProviderContext(documentUri, template, root, token.range)
      );

      validateChomp(diagnostics, token, parent, key, validationDefinition);
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

async function validateExpression(
  diagnostics: Diagnostic[],
  token: BasicExpressionToken,
  allowedContext: string[],
  contextProviderConfig: ContextProviderConfig | undefined,
  workflowContext: WorkflowContext
) {
  // Validate the expression
  for (const expression of token.originalExpressions || [token]) {
    const {namedContexts, functions} = splitAllowedContext(allowedContext);

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

function validateChomp(
  diagnostics: Diagnostic[],
  token: BasicExpressionToken,
  parent: TemplateToken | undefined,
  key: TemplateToken | undefined,
  validationDefinition: Definition | undefined
): void {
  // Not "clip" or "keep" chomp style?
  if (token.chompStyle !== "clip" && token.chompStyle !== "keep") {
    return;
  }

  // No definition? This can happen when the token is in an invalid position or the workflow has parse errors.
  if (!validationDefinition) {
    return;
  }

  // Step "run"?
  if (parent?.definition?.key === "run-step" && key?.isScalar && key.toString() === "run") {
    return;
  }

  // Block scalar indicator, i.e. | or >
  const scalarIndicator = token.scalarType === Scalar.BLOCK_LITERAL ? "|" : ">";

  const defKey = validationDefinition.key;
  const parentDefKey = parent?.definition?.key;

  // Error for boolean fields
  if (
    defKey === "job-if" ||
    defKey === "step-if" ||
    defKey === "step-continue-on-error" ||
    (parentDefKey === "job-factory" && key?.isScalar && key.toString() === "continue-on-error")
  ) {
    diagnostics.push({
      message: `Block scalar adds trailing newline which breaks boolean evaluation. Use '${scalarIndicator}-' to strip trailing newlines.`,
      range: mapRange(token.range),
      severity: DiagnosticSeverity.Error,
      code: "expression-block-scalar-chomping",
      source: "github-actions"
    });
  }
  // Error for number fields
  else if (
    defKey === "step-timeout-minutes" ||
    (parentDefKey === "container-mapping" && key?.isScalar && ["ports", "volumes"].includes(key.toString())) ||
    (parentDefKey === "job-factory" && key?.isScalar && key.toString() === "timeout-minutes")
  ) {
    diagnostics.push({
      message: `Block scalar adds trailing newline which breaks number parsing. Use '${scalarIndicator}-' to strip trailing newlines.`,
      range: mapRange(token.range),
      severity: DiagnosticSeverity.Error,
      code: "expression-block-scalar-chomping",
      source: "github-actions"
    });
  }
  // Error for specific string fields
  else if (
    defKey === "run-name" ||
    defKey === "step-name" ||
    defKey === "container" ||
    defKey === "services-container" ||
    defKey === "job-environment" ||
    defKey === "job-environment-name" ||
    defKey === "runs-on" ||
    defKey === "runs-on-labels" ||
    (parentDefKey === "container-mapping" && key?.isScalar && ["image", "credentials"].includes(key.toString())) ||
    (parentDefKey === "job-defaults-run" && key?.isScalar && ["shell", "working-directory"].includes(key.toString())) ||
    (parentDefKey === "job-environment-mapping" && key?.isScalar && key.toString() === "url") ||
    (parentDefKey === "job-factory" && key?.isScalar && key.toString() === "name") ||
    (parentDefKey === "workflow-job" && key?.isScalar && key.toString() === "name") ||
    (parentDefKey === "run-step" && key?.isScalar && key.toString() === "working-directory") ||
    (parentDefKey === "runs-on-mapping" && key?.isScalar && key.toString() === "group")
  ) {
    diagnostics.push({
      message: `Block scalar adds trailing newline. Use '${scalarIndicator}-' to strip trailing newlines.`,
      range: mapRange(token.range),
      severity: DiagnosticSeverity.Error,
      code: "expression-block-scalar-chomping",
      source: "github-actions"
    });
  }
  // Warning for everything else, but only on clip (default)
  else if (token.chompStyle === "clip") {
    diagnostics.push({
      message: `Block scalar adds trailing newline to expression result. Use '${scalarIndicator}-' to strip or '${scalarIndicator}+' to keep trailing newlines.`,
      range: mapRange(token.range),
      severity: DiagnosticSeverity.Warning,
      code: "expression-block-scalar-chomping",
      source: "github-actions"
    });
  }
}
