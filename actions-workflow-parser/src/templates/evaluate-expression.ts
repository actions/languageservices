import {Evaluator, Lexer, Parser} from "@github/actions-expressions";
import {Expr} from "@github/actions-expressions/ast";
import {Dictionary, ExpressionData, Kind} from "@github/actions-expressions/data/index";
import {FunctionInfo} from "@github/actions-expressions/funcs/info";
import {TemplateContext} from "./template-context";
import {
  BasicExpressionToken,
  BooleanToken,
  LiteralToken,
  MappingToken,
  NullToken,
  NumberToken,
  SequenceToken,
  StringToken,
  TemplateToken
} from "./tokens";
import {TokenType} from "./tokens/types";

export function evaluateStringToken(token: BasicExpressionToken, context: TemplateContext): TemplateToken {
  const expr = parseExpression(token.expression, context.expressionNamedContexts, context.expressionFunctions);
  if (!expr) {
    throw new Error("Unexpected empty expression");
  }
  // TODO: Pass in context
  const evaluator = new Evaluator(expr, new Dictionary());
  const result = evaluator.evaluate();
  if (!result.primitive) {
    context.error(token, "Expected a string");
    return new StringToken(token.file, token.range, token.expression, token.definitionInfo);
  }

  return new StringToken(token.file, token.range, result.coerceString(), token.definitionInfo);
}

export function evaluateSequenceToken(token: BasicExpressionToken, context: TemplateContext): TemplateToken {
  const expr = parseExpression(token.expression, context.expressionNamedContexts, context.expressionFunctions);
  if (!expr) {
    throw new Error("Unexpected empty expression");
  }
  // TODO: Pass in context
  const evaluator = new Evaluator(expr, new Dictionary());
  const result = evaluator.evaluate();
  const value = convertToTemplateToken(token, result);
  if (value.templateTokenType !== TokenType.Sequence) {
    context.error(token, "Expected a sequence");
    return new SequenceToken(token.file, token.range, token.definitionInfo);
  }
  return value;
}

export function evaluateMappingToken(token: BasicExpressionToken, context: TemplateContext): MappingToken {
  const expr = parseExpression(token.expression, context.expressionNamedContexts, context.expressionFunctions);
  if (!expr) {
    throw new Error("Unexpected empty expression");
  }
  // TODO: Pass in context
  const evaluator = new Evaluator(expr, new Dictionary());
  const result = evaluator.evaluate();
  const value = convertToTemplateToken(token, result);
  if (value.templateTokenType !== TokenType.Mapping) {
    context.error(token, "Expected a mapping");
    return new MappingToken(token.file, token.range, token.definitionInfo);
  }
  return value as MappingToken;
}

export function evaluateTemplateToken(token: BasicExpressionToken, context: TemplateContext): TemplateToken {
  const expr = parseExpression(token.expression, context.expressionNamedContexts, context.expressionFunctions);
  if (!expr) {
    throw new Error("Unexpected empty expression");
  }
  // TODO: Pass in context
  const evaluator = new Evaluator(expr, new Dictionary());
  const result = evaluator.evaluate();
  return convertToTemplateToken(token, result);
}

function convertToTemplateToken(token: BasicExpressionToken, result: ExpressionData): TemplateToken {
  // Literal
  const literal = convertToLiteralToken(token, result);
  if (literal) {
    return literal;
  }

  // TODO: Support expressions that return a sequence or mapping token

  // Leverage the expression SDK to traverse the object
  switch (result.kind) {
    case Kind.Dictionary: {
      const mapping = new MappingToken(token.file, token.range, token.definitionInfo);
      for (const {key, value} of result.pairs()) {
        const keyToken = new StringToken(token.file, token.range, key, token.definitionInfo);
        const valueToken = convertToTemplateToken(token, value);
        mapping.add(keyToken, valueToken);
      }
      return mapping;
    }
    case Kind.Array: {
      const sequence = new SequenceToken(token.file, token.range, token.definitionInfo);
      for (const value of result.values()) {
        const itemToken = convertToTemplateToken(token, value);
        sequence.add(itemToken);
      }
      return sequence;
    }
    default:
      throw new Error("Unable to convert the object to a template token");
  }
}

function convertToLiteralToken(token: BasicExpressionToken, result: ExpressionData): LiteralToken | undefined {
  switch (result.kind) {
    case Kind.Null:
      return new NullToken(token.file, token.range, token.definitionInfo);
    case Kind.Boolean:
      return new BooleanToken(token.file, token.range, result.value, token.definitionInfo);
    case Kind.Number:
      return new NumberToken(token.file, token.range, result.value, token.definitionInfo);
    case Kind.String:
      return new StringToken(token.file, token.range, result.value, token.definitionInfo);
  }

  return undefined;
}

function parseExpression(expression: string, contexts: string[], functions: FunctionInfo[]): Expr {
  const lexer = new Lexer(expression);
  const result = lexer.lex();
  const p = new Parser(result.tokens, contexts, functions);
  return p.parse();
}
