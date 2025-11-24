import {Pos} from "@actions/expressions/lexer";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";
import {isBasicExpression, isString} from "@actions/workflow-parser/templates/tokens/type-guards";
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

/**
 * Maps a document position to an expression position for hover/completion features.
 *
 * This handles both explicit expressions (with ${{ }}) and implicit expressions (like if conditions).
 * For if conditions without ${{ }}, this applies the same conversion as the parser's convertToIfCondition,
 * wrapping them in `success() && (...)` when no status function is present.
 *
 * @param token The template token at the position
 * @param position The position in the document
 * @returns Expression and adjusted position, or undefined if not an expression
 */
export function mapToExpressionPos(token: TemplateToken, position: Position): ExpressionPos | undefined {
  const pos: Pos = {
    line: position.line + 1,
    column: position.character + 1
  };

  // Handle if conditions that are string tokens (job-if, step-if, snapshot-if)
  const definitionKey = token.definition?.key;
  if (
    isString(token) &&
    token.range &&
    (definitionKey === "job-if" || definitionKey === "step-if" || definitionKey === "snapshot-if")
  ) {
    const condition = token.value.trim();
    if (condition) {
      // Check if the condition already contains a status function
      const hasStatusFunction = /\b(success|failure|cancelled|always)\s*\(/.test(condition);
      const finalCondition = hasStatusFunction ? condition : `success() && (${condition})`;

      const exprRange = mapRange(token.range);

      // Calculate offset for wrapping
      const offset = hasStatusFunction ? 0 : "success() && (".length;

      return {
        expression: finalCondition,
        position: {
          line: pos.line - exprRange.start.line - 1,
          column: pos.column - exprRange.start.character - 1 + offset
        },
        documentRange: exprRange
      };
    }
  }

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
