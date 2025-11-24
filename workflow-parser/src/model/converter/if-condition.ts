import {TemplateContext} from "../../templates/template-context";
import {BasicExpressionToken, ExpressionToken, TemplateToken} from "../../templates/tokens";

/**
 * Converts an if condition token to a BasicExpressionToken.
 * Similar to Go's convertToIfCondition - treats the value as a string and parses it as an expression.
 * Wraps the condition in success() && (...) if it doesn't already contain a status function.
 * This allows both 'if: success()' and 'if: ${{ success() }}' to work correctly.
 *
 * @param context The template context for error reporting
 * @param token The token containing the if condition
 * @param allowedContext The allowed expression contexts (varies by job-if vs step-if vs snapshot-if)
 * @returns A BasicExpressionToken with the processed condition, or undefined on error
 */
export function convertToIfCondition(
  context: TemplateContext,
  token: TemplateToken,
  allowedContext: string[]
): BasicExpressionToken | undefined {
  const scalar = token.assertScalar("if condition");

  // If it's already an expression, use its value
  let condition: string;
  let source: string | undefined;

  if (scalar instanceof BasicExpressionToken) {
    condition = scalar.expression;
    source = scalar.source;
  } else {
    // Otherwise, treat it as a string
    const stringToken = scalar.assertString("if condition");
    condition = stringToken.value.trim();
    source = stringToken.source;
  }

  if (!condition) {
    // Empty condition defaults to success()
    return new BasicExpressionToken(token.file, token.range, "success()", token.definitionInfo, undefined, undefined);
  }

  // Check if the condition already contains a status function (success, failure, cancelled, always)
  // This is a simple check - just look for these function names
  const hasStatusFunction = /\b(success|failure|cancelled|always)\s*\(/.test(condition);

  let finalCondition: string;
  if (hasStatusFunction) {
    finalCondition = condition;
  } else {
    // Wrap in success() && (condition)
    finalCondition = `success() && (${condition})`;
  }

  // Validate the expression before creating the token
  try {
    ExpressionToken.validateExpression(finalCondition, allowedContext);
  } catch (err) {
    context.error(token, err as Error);
    return undefined;
  }

  // Create a BasicExpressionToken with the final condition
  return new BasicExpressionToken(token.file, token.range, finalCondition, token.definitionInfo, undefined, source);
}

/**
 * Allowed context for job-level if conditions
 */
export const JOB_IF_CONTEXT = [
  "github",
  "inputs",
  "vars",
  "needs",
  "always(0,0)",
  "failure(0,MAX)",
  "cancelled(0,0)",
  "success(0,MAX)"
];

/**
 * Allowed context for step-level if conditions
 */
export const STEP_IF_CONTEXT = [
  "github",
  "inputs",
  "vars",
  "needs",
  "strategy",
  "matrix",
  "steps",
  "job",
  "runner",
  "env",
  "always(0,0)",
  "failure(0,0)",
  "cancelled(0,0)",
  "success(0,0)",
  "hashFiles(1,255)"
];

/**
 * Allowed context for snapshot-level if conditions
 */
export const SNAPSHOT_IF_CONTEXT = [
  "github",
  "inputs",
  "vars",
  "needs",
  "strategy",
  "matrix",
  "steps",
  "job",
  "runner",
  "env",
  "always(0,0)",
  "failure(0,0)",
  "cancelled(0,0)",
  "success(0,0)",
  "hashFiles(1,255)"
];
