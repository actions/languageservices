import {Evaluator, Lexer, Parser} from "@github/actions-expressions";
import {Expr} from "@github/actions-expressions/ast";
import {
  convertWorkflowTemplate,
  isBasicExpression,
  parseWorkflow,
  ParseWorkflowResult
} from "@github/actions-workflow-parser";
import {splitAllowedContext} from "@github/actions-workflow-parser/templates/tokens/expression-token";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {TokenRange} from "@github/actions-workflow-parser/templates/tokens/token-range";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {TextDocument} from "vscode-languageserver-textdocument";
import {Diagnostic, DiagnosticSeverity, Range} from "vscode-languageserver-types";

import {ContextProviderConfig} from "./context-providers/config";
import {getContext} from "./context-providers/default";
import {AccessError, wrapDictionary} from "./expression-validation/error-dictionary";
import {nullTrace} from "./nulltrace";
import {ValueProviderConfig} from "./value-providers/config";

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
      convertWorkflowTemplate(result.context, result.value);
    }

    // Validate expressions
    validateExpressions(diagnostics, result, contextProviderConfig);

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

function validateExpressions(
  diagnotics: Diagnostic[],
  result: ParseWorkflowResult,
  contextProviderConfig: ContextProviderConfig | undefined
) {
  if (!result.value) {
    return;
  }

  // Iterate over the parsed workflow
  for (const token of TemplateToken.traverse(result.value)) {
    if (isBasicExpression(token)) {
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
            diagnotics.push({
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
  }
}
