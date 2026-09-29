/**
 * Format string validation for format() function calls.
 * Port of Go's format_validator.go from actions-workflow-parser.
 */

import {Expr, FunctionCall, Literal, Binary, Unary, Logical, Grouping, IndexAccess} from "@actions/expressions/ast";
import {Kind} from "@actions/expressions/data/expressiondata";

/**
 * Error types for format string validation
 */
export type FormatStringError =
  | {type: "invalid-syntax"; message: string}
  | {type: "arg-count-mismatch"; expected: number; provided: number};

/**
 * Validates a format string and returns the maximum placeholder index.
 * Port of Go's validateFormatString from format_validator.go.
 *
 * @param formatString The format string to validate
 * @returns { valid: boolean, maxArgIndex: number } where maxArgIndex is -1 if no placeholders
 */
export function validateFormatString(formatString: string): {valid: boolean; maxArgIndex: number} {
  let maxIndex = -1;
  let i = 0;

  while (i < formatString.length) {
    // Find next left brace
    let lbrace = -1;
    for (let j = i; j < formatString.length; j++) {
      if (formatString[j] === "{") {
        lbrace = j;
        break;
      }
    }

    // Find next right brace
    let rbrace = -1;
    for (let j = i; j < formatString.length; j++) {
      if (formatString[j] === "}") {
        rbrace = j;
        break;
      }
    }

    // No more braces
    if (lbrace < 0 && rbrace < 0) {
      break;
    }

    // Left brace comes first (or only left brace exists)
    if (lbrace >= 0 && (rbrace < 0 || lbrace < rbrace)) {
      // Check if it's escaped
      if (lbrace + 1 < formatString.length && formatString[lbrace + 1] === "{") {
        // Escaped left brace
        i = lbrace + 2;
        continue;
      }

      // This is a placeholder opening - find the closing brace
      rbrace = -1;
      for (let j = lbrace + 1; j < formatString.length; j++) {
        if (formatString[j] === "}") {
          rbrace = j;
          break;
        }
      }

      if (rbrace < 0) {
        // Missing closing brace
        return {valid: false, maxArgIndex: -1};
      }

      // Validate placeholder content (must be digits only)
      if (rbrace === lbrace + 1) {
        // Empty placeholder {}
        return {valid: false, maxArgIndex: -1};
      }

      // Parse the index and validate it's all digits
      let index = 0;
      for (let j = lbrace + 1; j < rbrace; j++) {
        const c = formatString[j];
        if (c < "0" || c > "9") {
          // Non-numeric character
          return {valid: false, maxArgIndex: -1};
        }
        index = index * 10 + (c.charCodeAt(0) - "0".charCodeAt(0));
      }

      if (index > maxIndex) {
        maxIndex = index;
      }

      i = rbrace + 1;
      continue;
    }

    // Right brace comes first (or only right brace exists)
    // Check if it's escaped
    if (rbrace + 1 < formatString.length && formatString[rbrace + 1] === "}") {
      // Escaped right brace
      i = rbrace + 2;
      continue;
    }

    // Unescaped right brace outside of placeholder
    return {valid: false, maxArgIndex: -1};
  }

  return {valid: true, maxArgIndex: maxIndex};
}

/**
 * Walks an expression AST to find and validate all format() function calls.
 *
 * @param expr The expression AST to validate
 * @returns Array of validation errors found
 */
export function validateFormatCalls(expr: Expr): FormatStringError[] {
  const errors: FormatStringError[] = [];
  const stack: Expr[] = [expr];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }

    if (node instanceof FunctionCall) {
      if (node.functionName.lexeme.toLowerCase() === "format") {
        const error = validateSingleFormatCall(node);
        if (error) {
          errors.push(error);
        }
      }
      // Push args for further processing (to find nested format calls)
      for (const arg of node.args) {
        stack.push(arg);
      }
    } else if (node instanceof Binary) {
      stack.push(node.left, node.right);
    } else if (node instanceof Unary) {
      stack.push(node.expr);
    } else if (node instanceof Logical) {
      for (const arg of node.args) {
        stack.push(arg);
      }
    } else if (node instanceof Grouping) {
      stack.push(node.group);
    } else if (node instanceof IndexAccess) {
      stack.push(node.expr, node.index);
    }
    // Literal, ContextAccess - no children to process
  }

  return errors;
}

/**
 * Validates a single format() function call.
 *
 * @param fc The FunctionCall AST node
 * @returns Validation error if found, undefined if valid
 */
function validateSingleFormatCall(fc: FunctionCall): FormatStringError | undefined {
  // Must have at least one argument (the format string)
  if (fc.args.length < 1) {
    return undefined;
  }

  // First argument must be a string literal
  const firstArg = fc.args[0];
  if (!(firstArg instanceof Literal) || firstArg.literal.kind !== Kind.String) {
    return undefined; // Can't validate dynamic format strings
  }

  const formatString = firstArg.literal.coerceString();
  const numArgs = fc.args.length - 1; // Subtract 1 for format string itself

  const {valid, maxArgIndex} = validateFormatString(formatString);

  if (!valid) {
    return {
      type: "invalid-syntax",
      message: "Format string has invalid syntax (missing closing brace, unescaped braces, or invalid placeholder)"
    };
  }

  if (maxArgIndex >= numArgs) {
    return {
      type: "arg-count-mismatch",
      expected: maxArgIndex + 1, // Convert 0-based index to count
      provided: numArgs
    };
  }

  return undefined;
}
