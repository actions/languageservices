import {Pos} from "@actions/expressions/lexer";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";
import {isBasicExpression} from "@actions/workflow-parser/templates/tokens/type-guards";
import {Position, Range as LSPRange} from "vscode-languageserver-textdocument";
import {mapRange} from "../utils/range";
import {posWithinRange} from "./pos-range";

export type ExpressionPos = {
  /** The expression that includes the position */
  expression: string;

  /** Adjusted position, pointing into the expression */
  position: Pos;

  /** Range of the expression in the document */
  documentRange: LSPRange;
};

export function mapToExpressionPos(token: TemplateToken, position: Position): ExpressionPos | undefined {
  const pos: Pos = {
    line: position.line + 1,
    column: position.character + 1
  };

  if (!isBasicExpression(token)) {
    return undefined;
  }

  if (token.originalExpressions?.length) {
    for (const originalExp of token.originalExpressions) {
      // Find the original expression that contains the position
      if (originalExp.expressionRange && posWithinRange(pos, originalExp.expressionRange)) {
        const exprRange = mapRange(originalExp.expressionRange);

        return {
          expression: originalExp.expression,
          // Adjust the position to point into the expression
          position: {
            line: pos.line - exprRange.start.line - 1,
            column: pos.column - exprRange.start.character - 1
          },
          documentRange: exprRange
        };
      }
    }

    return undefined;
  }

  const exprRange = mapRange(token.expressionRange);
  return {
    expression: token.expression,
    // Adjust the position to point into the expression
    position: {
      line: pos.line - exprRange.start.line - 1,
      column: pos.column - exprRange.start.character - 1
    },
    documentRange: exprRange
  };
}
