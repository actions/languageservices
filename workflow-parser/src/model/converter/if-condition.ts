import {Lexer, Parser} from "@actions/expressions";
import {Binary, Expr, FunctionCall, Grouping, IndexAccess, Logical, Unary} from "@actions/expressions/ast";
import {DefinitionInfo} from "../../templates/schema/definition-info.js";
import {splitAllowedContext} from "../../templates/allowed-context.js";
import {TemplateContext} from "../../templates/template-context.js";
import {BasicExpressionToken, ExpressionToken, TemplateToken} from "../../templates/tokens/index.js";

/**
 * Ensures a condition expression contains a status function call.
 * If the condition doesn't contain success(), failure(), cancelled(), or always(),
 * wraps it in `success() && (condition)`.
 *
 * Parses the expression to accurately detect status functions, avoiding false positives
 * from string literals or property access. If parsing fails (e.g., partially typed expression),
 * returns the original condition unchanged to allow validation to report the actual error.
 *
 * @param condition The condition expression to check
 * @param definitionInfo Schema definition containing allowed contexts for parsing
 * @returns The condition with status function guaranteed, or original on parse error
 */
export function ensureStatusFunction(condition: string, definitionInfo: DefinitionInfo | undefined): string {
  const allowedContext = definitionInfo?.allowedContext || [];

  try {
    const {namedContexts, functions} = splitAllowedContext(allowedContext);
    const lexer = new Lexer(condition);
    const result = lexer.lex();
    const parser = new Parser(result.tokens, namedContexts, functions);
    const tree = parser.parse();

    // Check if tree contains status function
    if (walkTreeToFindStatusFunctionCalls(tree)) {
      return condition; // Already has status function
    }

    // Wrap it
    return `success() && (${condition})`;
  } catch {
    // Parse error - return original and let validation report the actual error
    // This is important for hover/autocomplete on partially-typed expressions
    return condition;
  }
}

/**
 * Converts an if condition token to a BasicExpressionToken.
 * Treats the value as a string and parses it as an expression.
 * Wraps the condition in success() && (...) if it doesn't already contain a status function.
 * This allows both 'if: success()' and 'if: ${{ success() }}' to work correctly.
 *
 * Reads the allowed context directly from the schema definition attached to the token,
 * ensuring consistency with the schema.
 *
 * @param context The template context for error reporting
 * @param token The token containing the if condition
 * @returns A BasicExpressionToken with the processed condition, or undefined on error
 */
export function convertToIfCondition(context: TemplateContext, token: TemplateToken): BasicExpressionToken | undefined {
  const scalar = token.assertScalar("if condition");

  // Get allowed context from the schema definition attached to the token
  const allowedContext = token.definitionInfo?.allowedContext || [];

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

  let finalCondition: string;
  if (!condition) {
    // Empty condition defaults to success()
    finalCondition = "success()";
  } else {
    // Ensure the condition has a status function, wrapping if needed
    finalCondition = ensureStatusFunction(condition, token.definitionInfo);
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
 * Walks an expression AST to find status function calls (success, failure, cancelled, always).
 * Recursively checks all nodes including function arguments and logical/binary operations.
 */
function walkTreeToFindStatusFunctionCalls(tree: Expr | undefined): boolean {
  if (!tree) {
    return false;
  }

  if (tree instanceof FunctionCall) {
    const funcName = tree.functionName.lexeme.toLowerCase();
    if (funcName === "success" || funcName === "failure" || funcName === "cancelled" || funcName === "always") {
      return true;
    }
    // Check arguments recursively
    return tree.args.some(arg => walkTreeToFindStatusFunctionCalls(arg));
  }

  if (tree instanceof Binary) {
    return walkTreeToFindStatusFunctionCalls(tree.left) || walkTreeToFindStatusFunctionCalls(tree.right);
  }

  if (tree instanceof Unary) {
    return walkTreeToFindStatusFunctionCalls(tree.expr);
  }

  if (tree instanceof Logical) {
    return tree.args.some(arg => walkTreeToFindStatusFunctionCalls(arg));
  }

  if (tree instanceof Grouping) {
    return walkTreeToFindStatusFunctionCalls(tree.group);
  }

  if (tree instanceof IndexAccess) {
    return walkTreeToFindStatusFunctionCalls(tree.expr) || walkTreeToFindStatusFunctionCalls(tree.index);
  }

  return false;
}

/**
 * Validates a pre-if or post-if condition string.
 * Unlike step if conditions, pre-if and post-if are evaluated as-is by the runner
 * (they default to always() only when the field is missing entirely).
 * This function validates the expression and reports errors through the context.
 *
 * @param context The template context for error reporting
 * @param token The token containing the condition
 * @param condition The condition string to validate
 * @returns The validated condition string, or undefined on error
 */
export function validateRunsIfCondition(
  context: TemplateContext,
  token: TemplateToken,
  condition: string
): string | undefined {
  const allowedContext = token.definitionInfo?.allowedContext || [];

  // Validate the expression directly - no wrapping needed for pre-if/post-if
  try {
    ExpressionToken.validateExpression(condition, allowedContext);
  } catch (err) {
    context.error(token, err as Error);
    return undefined;
  }

  return condition;
}
