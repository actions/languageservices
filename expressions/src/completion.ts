import {DescriptionPair} from "./completion/descriptionDictionary.js";
import {Dictionary, isDictionary} from "./data/dictionary.js";
import {ExpressionData} from "./data/expressiondata.js";
import {Evaluator} from "./evaluator.js";
import {FeatureFlags} from "./features.js";
import {wellKnownFunctions} from "./funcs.js";
import {FunctionDefinition, FunctionInfo} from "./funcs/info.js";
import {Lexer, Token, TokenType} from "./lexer.js";
import {Parser} from "./parser.js";

export type CompletionItem = {
  label: string;
  description?: string;
  function: boolean;
};

/**
 * Complete returns a list of completion items for the given expression.
 * The main functionality is auto-completing functions and context access:
 * We can only provide assistance if the input is in one of the following forms (with | denoting the cursor position):
 * - context.path.inp| or context.path['inp| -- auto-complete context access
 * - context.path.| or context.path['| -- auto-complete context access
 * - toJS| -- auto-complete function call or top-level
 * - | -- auto-complete function call or top-level context access
 *
 * @param input Input expression
 * @param context Context available for the expression
 * @param extensionFunctions List of functions available
 * @param functions Optional map of functions to use during evaluation
 * @param featureFlags Optional feature flags to control which features are enabled
 * @returns Array of completion items
 */
export function complete(
  input: string,
  context: Dictionary,
  extensionFunctions: FunctionInfo[],
  functions?: Map<string, FunctionDefinition>,
  featureFlags?: FeatureFlags
): CompletionItem[] {
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
    result.push(...functionItems(extensionFunctions, featureFlags));

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

  const ev = new Evaluator(expr, context, functions);
  const result = ev.evaluate();

  return contextKeys(result);
}

function functionItems(extensionFunctions: FunctionInfo[], featureFlags?: FeatureFlags): CompletionItem[] {
  const result: CompletionItem[] = [];
  const flags = featureFlags ?? new FeatureFlags();

  for (const fdef of [...Object.values(wellKnownFunctions), ...extensionFunctions]) {
    // Filter out case function if feature is disabled
    if (fdef.name === "case" && !flags.isEnabled("allowCaseFunction")) {
      continue;
    }
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
        .map(x => completionItemFromContext(x))
        // Sort contexts
        .sort((a, b) => a.label.localeCompare(b.label))
    );
  }

  return [];
}

function completionItemFromContext(pair: DescriptionPair): CompletionItem {
  const context = pair.key.toString();
  const parenIndex = context.indexOf("(");
  const isFunc = parenIndex >= 0 && context.indexOf(")") >= 0;

  return {
    label: isFunc ? context.substring(0, parenIndex) : context,
    description: pair.description,
    function: isFunc
  };
}

export function trimTokenVector(tokenVector: Token[]): Token[] {
  let tokenIdx = tokenVector.length;

  let openParen = 0;

  while (tokenIdx > 0) {
    const token = tokenVector[tokenIdx - 1];
    switch (token.type) {
      case TokenType.LEFT_PAREN:
        if (openParen == 0) {
          // Encountered an open parenthesis without a closing first, stop here
          break;
        }
        openParen--;
        tokenIdx--;
        continue;

      case TokenType.RIGHT_PAREN:
        openParen++;
        tokenIdx--;
        continue;

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
