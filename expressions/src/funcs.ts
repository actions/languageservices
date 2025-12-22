import {ErrorType, ExpressionError} from "./errors.js";
import {contains} from "./funcs/contains.js";
import {endswith} from "./funcs/endswith.js";
import {format} from "./funcs/format.js";
import {fromjson} from "./funcs/fromjson.js";
import {FunctionDefinition, FunctionInfo} from "./funcs/info.js";
import {join} from "./funcs/join.js";
import {startswith} from "./funcs/startswith.js";
import {tojson} from "./funcs/tojson.js";
import {Token} from "./lexer.js";

export type ParseContext = {
  allowUnknownKeywords: boolean;
  extensionContexts: Map<string, boolean>;
  extensionFunctions: Map<string, FunctionInfo>;
};

export const wellKnownFunctions: {[name: string]: FunctionDefinition} = {
  contains: contains,
  endswith: endswith,
  format: format,
  fromjson: fromjson,
  join: join,
  startswith: startswith,
  tojson: tojson
};

// validateFunction returns the function definition for the given function name.
// If the function does not exist or an incorrect number of arguments is provided,
// an error is returned.
export function validateFunction(context: ParseContext, identifier: Token, argCount: number) {
  // Expression function names are case-insensitive.
  const name = identifier.lexeme.toLowerCase();

  let f: FunctionInfo | undefined;
  f = wellKnownFunctions[name];
  if (!f) {
    f = context.extensionFunctions.get(name);
    if (!f) {
      if (!context.allowUnknownKeywords) {
        throw new ExpressionError(ErrorType.ErrorUnrecognizedFunction, identifier);
      }

      // Skip argument validation for unknown functions
      return;
    }
  }

  if (argCount < f.minArgs) {
    throw new ExpressionError(ErrorType.ErrorTooFewParameters, identifier);
  }

  if (argCount > f.maxArgs) {
    throw new ExpressionError(ErrorType.ErrorTooManyParameters, identifier);
  }
}
