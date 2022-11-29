import {Evaluator, Lexer, Parser} from "@github/actions-expressions";
import {Expr} from "@github/actions-expressions/ast";
import {
  convertWorkflowTemplate,
  isBasicExpression,
  isSequence,
  isString,
  parseWorkflow,
  ParseWorkflowResult,
  WorkflowTemplate
} from "@github/actions-workflow-parser";
import {splitAllowedContext} from "@github/actions-workflow-parser/templates/allowed-context";
import {BasicExpressionToken} from "@github/actions-workflow-parser/templates/tokens/basic-expression-token";
import {StringToken} from "@github/actions-workflow-parser/templates/tokens/string-token";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {TokenRange} from "@github/actions-workflow-parser/templates/tokens/token-range";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {TextDocument} from "vscode-languageserver-textdocument";
import {Diagnostic, DiagnosticSeverity, Range, URI} from "vscode-languageserver-types";

import {ContextProviderConfig} from "./context-providers/config";
import {getContext} from "./context-providers/default";
import {getWorkflowContext, WorkflowContext} from "./context/workflow-context";
import {AccessError, wrapDictionary} from "./expression-validation/error-dictionary";
import {nullTrace} from "./nulltrace";
import {findToken} from "./utils/find-token";
import {ValueProviderConfig, ValueProviderKind} from "./value-providers/config";
import {defaultValueProviders} from "./value-providers/default";

/**
 * Validates a workflow file
 *
 * @param textDocument Document to validate
 * @returns Array of diagnostics
 */
export async function validate(
  textDocument: TextDocument,
  // TODO: Support multiple files, context for API calls
  valueProviderConfig?: ValueProviderConfig,
  contextProviderConfig?: ContextProviderConfig
): Promise<Diagnostic[]> {
  const file: File = {
    name: textDocument.uri,
    content: textDocument.getText()
  };

  const diagnostics: Diagnostic[] = [];

  try {
    const result: ParseWorkflowResult = parseWorkflow(file.name, [file], nullTrace);
    if (result.value) {
      // Errors will be updated in the context
      const template = convertWorkflowTemplate(result.context, result.value);

      // Validate expressions and value providers
      await additionalValidations(
        diagnostics,
        textDocument.uri,
        template,
        result.value,
        valueProviderConfig,
        contextProviderConfig
      );
    }

    // For now map parser errors directly to diagnostics
    for (const error of result.context.errors.getErrors()) {
      let range = mapRange(error.range);

      diagnostics.push({
        message: error.rawMessage,
        range
      });
    }
  } catch (e) {
    // TODO: Handle error here
  }

  return diagnostics;
}

function mapRange(range: TokenRange | undefined): Range {
  if (!range) {
    return {
      start: {
        line: 1,
        character: 1
      },
      end: {
        line: 1,
        character: 1
      }
    };
  }

  return {
    start: {
      line: range.start[0] - 1,
      character: range.start[1] - 1
    },
    end: {
      line: range.end[0] - 1,
      character: range.end[1] - 1
    }
  };
}

async function additionalValidations(
  diagnostics: Diagnostic[],
  documentUri: URI,
  template: WorkflowTemplate,
  root: TemplateToken,
  valueProviderConfig: ValueProviderConfig | undefined,
  contextProviderConfig: ContextProviderConfig | undefined
) {
  for (const token of TemplateToken.traverse(root)) {
    // If this is an expression, validate it
    if (isBasicExpression(token)) {
      validateExpression(diagnostics, token, contextProviderConfig);
    }

    // Allowed values coming from the schema have already been validated. Only check if
    // a value provider is defined for a token and if it is, validate the values match.
    if (valueProviderConfig && token.range && token.definition?.key) {
      const defKey = token.definition.key;

      // Try a custom value provider first
      let valueProvider = valueProviderConfig[defKey];
      if (!valueProvider) {
        // fall back to default
        valueProvider = defaultValueProviders[defKey];
      }

      if (valueProvider) {
        const customValues = await valueProvider.get(getProviderContext(documentUri, template, root, token));

        if (isSequence(token)) {
          for (let i = 0; i < token.count; ++i) {
            const entry = token.get(i);

            if (isString(entry)) {
              if (!customValues.map(x => x.label).includes(entry.value)) {
                invalidValue(diagnostics, entry, valueProvider.kind);
              }
            }
          }
        }

        if (isString(token)) {
          if (!customValues.map(x => x.label).includes(token.value)) {
            invalidValue(diagnostics, token, valueProvider.kind);
          }
        }
      }
    }
  }
}

function invalidValue(diagnostics: Diagnostic[], token: StringToken, kind: ValueProviderKind) {
  diagnostics.push({
    message: `Value '${token.value}' is not valid`,
    severity: kind === ValueProviderKind.AllowedValues ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
    range: mapRange(token.range)
  });
}

function getProviderContext(
  documentUri: URI,
  template: WorkflowTemplate,
  root: TemplateToken,
  token: TemplateToken
): WorkflowContext {
  const {parent, path} = findToken(
    {
      line: token.range!.start[0],
      character: token.range!.start[1]
    },
    root
  );
  return getWorkflowContext(documentUri, template, path);
}

function validateExpression(
  diagnostics: Diagnostic[],
  token: BasicExpressionToken,
  contextProviderConfig: ContextProviderConfig | undefined
) {
  // Validate the expression
  for (const expression of token.originalExpressions || [token]) {
    const allowedContexts = token.definition?.readerContext || [];
    const {namedContexts, functions} = splitAllowedContext(allowedContexts);

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
      const context = getContext(namedContexts, contextProviderConfig);

      const e = new Evaluator(expr, wrapDictionary(context));
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
      } else {
        // Ignore error
      }
    }
  }
}
