import {Pos} from "@actions/expressions/lexer";
import {ensureStatusFunction} from "@actions/workflow-parser/model/converter/if-condition";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";
import {isBasicExpression, isString} from "@actions/workflow-parser/templates/tokens/type-guards";
import {Position, Range as LSPRange} from "vscode-languageserver-textdocument";
import {mapRange} from "../utils/range.js";
import {posWithinRange} from "./pos-range.js";

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
      // Ensure the condition has a status function, wrapping if needed
      const finalCondition = ensureStatusFunction(condition, token.definitionInfo);

      const exprRange = mapRange(token.range);

      // Calculate offset: find where the original condition appears in the final expression
      // If wrapped, it will be after "success() && (", otherwise it's at position 0
      const offset = finalCondition.indexOf(condition);

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
