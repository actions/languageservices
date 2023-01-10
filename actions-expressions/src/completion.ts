import {Dictionary, isDictionary} from "./data/dictionary";
import {ExpressionData} from "./data/expressiondata";
import {Evaluator} from "./evaluator";
import {wellKnownFunctions} from "./funcs";
import {FunctionInfo} from "./funcs/info";
import {Lexer, Token, TokenType} from "./lexer";
import {Parser} from "./parser";

export type CompletionItem = {
  label: string;
  description?: string;
  function: boolean;
};

// Complete returns a list of completion items for the given expression.
//
// The main functionality is auto-completing functions and context access:
// We can only provide assistance if the input is in one of the following forms (with | denoting the cursor position):
// - context.path.inp| or context.path['inp| -- auto-complete context access
// - context.path.| or context.path['| -- auto-complete context access
// - toJS| -- auto-complete function call or top-level
// - | -- auto-complete function call or top-level context access
export function complete(input: string, context: Dictionary, extensionFunctions: FunctionInfo[]): CompletionItem[] {
  // Lex
  const lexer = new Lexer(input);
  const lexResult = lexer.lex();

  // Find interesting part of the tokenVector. For example, for an expression like `github.actor == env.actor.log|`, we are
  // only interested in the `env.actor.log` part for auto-completion
  const tokenInputVector = trimTokenVector(lexResult.tokens);

  // Start by skipping the EOF token
  let tokenIdx = tokenInputVector.length - 2;

  if (tokenIdx >= 0) {
    switch (tokenInputVector[tokenIdx].type) {
      // If there is a (partial) identifier under the cursor, ignore that
      case TokenType.IDENTIFIER:
        tokenIdx--;
        break;

      case TokenType.STRING:
        // TODO: Support string for `context.name['test|`
        return [];
    }
  }

  if (tokenIdx < 0) {
    // Vector only contains the EOF token. Suggest functions and root context access
    const result = contextKeys(context);

    // Merge with functions
    result.push(...functionItems(extensionFunctions));

    return result;
  }

  // Determine path that led to the last token
  // Use parser & evaluator to determine context to complete.
  const pathTokenVector = tokenInputVector.slice(0, tokenIdx);

  // Include the original EOF token to make the parser happy
  pathTokenVector.push(tokenInputVector[tokenInputVector.length - 1]);

  const p = new Parser(
    pathTokenVector,
    context.pairs().map(x => x.key),
    extensionFunctions
  );
  const expr = p.parse();

  const ev = new Evaluator(expr, context);
  const result = ev.evaluate();

  return contextKeys(result);
}

function functionItems(extensionFunctions: FunctionInfo[]): CompletionItem[] {
  const result: CompletionItem[] = [];

  for (const fdef of [...Object.values(wellKnownFunctions), ...extensionFunctions]) {
    result.push({
      label: fdef.name,
      description: fdef.description,
      function: true
    });
  }

  // Sort functions
  result.sort((a, b) => a.label.localeCompare(b.label));

  return result;
}

function contextKeys(context: ExpressionData): CompletionItem[] {
  if (isDictionary(context)) {
    return (
      context
        .pairs()
        .map(x => completionItemFromContext(x.key))
        // Sort contexts
        .sort((a, b) => a.label.localeCompare(b.label))
    );
  }

  return [];
}

function completionItemFromContext(context: string): CompletionItem {
  const parenIndex = context.indexOf("(");
  const isFunc = parenIndex >= 0 && context.indexOf(")") >= 0;

  return {
    label: isFunc ? context.substring(0, parenIndex) : context,
    function: isFunc
  };
}

export function trimTokenVector(tokenVector: Token[]): Token[] {
  let tokenIdx = tokenVector.length;

  while (tokenIdx > 0) {
    const token = tokenVector[tokenIdx - 1];
    switch (token.type) {
      case TokenType.IDENTIFIER:
      case TokenType.DOT:
      case TokenType.EOF:
      case TokenType.LEFT_BRACKET:
      case TokenType.RIGHT_BRACKET:
      case TokenType.STRING:
        tokenIdx--;
        continue;
    }

    break;
  }

  // Only keep the part of the token vector we're interested in
  return tokenVector.slice(tokenIdx);
}
