/**
 * Shared validation utilities for `if` condition literal text detection.
 * Used by both workflow and action validation.
 */

import {data} from "@actions/expressions";
import {Expr, FunctionCall, Literal, Logical} from "@actions/expressions/ast";

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
export function hasFormatWithLiteralText(expr: Expr): boolean {
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
