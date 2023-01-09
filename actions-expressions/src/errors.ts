import { Pos, Token, tokenString } from "./lexer";

export const MAX_PARSER_DEPTH = 50;
export const MAX_EXPRESSION_LENGTH = 21000;

export enum ErrorType {
  ErrorUnexpectedSymbol,
  ErrorUnrecognizedNamedValue,
  ErrorUnexpectedEndOfExpression,

  ErrorExceededMaxDepth,
  ErrorExceededMaxLength,
  ErrorTooFewParameters,
  ErrorTooManyParameters,
  ErrorUnrecognizedContext,
  ErrorUnrecognizedFunction,
}

export class ExpressionError extends Error {
  constructor(private typ: ErrorType, private tok: Token) {
    super(`${errorDescription(typ)}: '${tokenString(tok)}'`);

    this.pos = this.tok.pos;
  }

  public pos: Pos;
}

function errorDescription(typ: ErrorType): string {
  switch (typ) {
    case ErrorType.ErrorUnexpectedEndOfExpression:
      return "Unexpected end of expression";
    case ErrorType.ErrorUnexpectedSymbol:
      return "Unexpected symbol";
    case ErrorType.ErrorUnrecognizedNamedValue:
      return "Unrecognized named-value";
    case ErrorType.ErrorExceededMaxDepth:
      return `Exceeded max expression depth ${MAX_PARSER_DEPTH}`;
    case ErrorType.ErrorExceededMaxLength:
      return `Exceeded max expression length ${MAX_EXPRESSION_LENGTH}`;
    case ErrorType.ErrorTooFewParameters:
      return "Too few parameters supplied";
    case ErrorType.ErrorTooManyParameters:
      return "Too many parameters supplied";
      case ErrorType.ErrorUnrecognizedContext:
        return "Unrecognized named-value";
    case ErrorType.ErrorUnrecognizedFunction:
      return "Unrecognized function";
    default: // Should never reach here.
      return "Unknown error";
  }
}
