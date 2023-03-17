import {Evaluator, ExpressionEvaluationError, Lexer, Parser} from "@github/actions-expressions";
import {Expr} from "@github/actions-expressions/ast";
import {isBasicExpression, isString, ParseWorkflowResult, WorkflowTemplate} from "@github/actions-workflow-parser";
import {ErrorPolicy} from "@github/actions-workflow-parser/model/convert";
import {splitAllowedContext} from "@github/actions-workflow-parser/templates/allowed-context";
import {BasicExpressionToken} from "@github/actions-workflow-parser/templates/tokens/basic-expression-token";
import {StringToken} from "@github/actions-workflow-parser/templates/tokens/string-token";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {FileProvider} from "@github/actions-workflow-parser/workflows/file-provider";
import {TextDocument} from "vscode-languageserver-textdocument";
import {Diagnostic, DiagnosticSeverity, URI} from "vscode-languageserver-types";
import {ActionMetadata, ActionReference} from "./action";
import {ContextProviderConfig} from "./context-providers/config";
import {getContext, Mode} from "./context-providers/default";
import {getWorkflowContext, WorkflowContext} from "./context/workflow-context";
import {AccessError, wrapDictionary} from "./expression-validation/error-dictionary";
import {validatorFunctions} from "./expression-validation/functions";
import {error} from "./log";
import {findToken} from "./utils/find-token";
import {mapRange} from "./utils/range";
import {validateAction} from "./validate-action";
import {ValueProviderConfig, ValueProviderKind} from "./value-providers/config";
import {defaultValueProviders} from "./value-providers/default";
import {fetchOrParseWorkflow, fetchOrConvertWorkflowTemplate} from "./utils/workflow-cache";

export type ValidationConfig = {
  valueProviderConfig?: ValueProviderConfig;
  contextProviderConfig?: ContextProviderConfig;
  fetchActionMetadata?(action: ActionReference): Promise<ActionMetadata | undefined>;
  fileProvider?: FileProvider;
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
    error(`Unhandled error while validating: ${e}`);
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
    if (isBasicExpression(token)) {
      await validateExpression(
        diagnostics,
        token,
        validationToken.definitionInfo?.allowedContext || [],
        config?.contextProviderConfig,
        getProviderContext(documentUri, template, root, token)
      );
    }

    if (token.definition?.key === "regular-step") {
      const context = getProviderContext(documentUri, template, root, token);
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
        const customValues = await valueProvider.get(getProviderContext(documentUri, template, root, token));
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
  token: TemplateToken
): WorkflowContext {
  const {parent, path} = findToken(
    {
      line: token.range!.start.line - 1,
      character: token.range!.start.column - 1
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

    try {
      const context = await getContext(namedContexts, contextProviderConfig, workflowContext, Mode.Validation);

      const e = new Evaluator(expr, wrapDictionary(context), validatorFunctions);
      e.evaluate();

      // Any invalid context access would've thrown an error via the `ErrorDictionary`, for now we don't have to check the actual
      // result of the evaluation.
    } catch (e) {
      if (e instanceof AccessError) {
        diagnostics.push({
          message: `Context access might be invalid: ${e.keyName}`,
          severity: DiagnosticSeverity.Warning,
          range: mapRange(expression.range)
        });
      } else if (e instanceof ExpressionEvaluationError) {
        diagnostics.push({
          message: `Expression might be invalid: ${e.message}`,
          severity: DiagnosticSeverity.Error,
          range: mapRange(expression.range)
        });
      }
    }
  }
}
