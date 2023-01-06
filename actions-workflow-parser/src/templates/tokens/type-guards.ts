import { BasicExpressionToken } from "./basic-expression-token"
import { BooleanToken } from "./boolean-token"
import { LiteralToken } from "./literal-token"
import { MappingToken } from "./mapping-token"
import { NumberToken } from "./number-token"
import { ScalarToken } from "./scalar-token"
import { SequenceToken } from "./sequence-token"
import { StringToken } from "./string-token"
import { TemplateToken } from "./template-token"
import { TokenType } from "./types"

export function isLiteral(t: TemplateToken): t is LiteralToken {
  return t.isLiteral
}

export function isScalar(t: TemplateToken): t is ScalarToken {
  return t.isScalar
}

export function isString(t: TemplateToken): t is StringToken {
  return isLiteral(t) && t.templateTokenType === TokenType.String
}

export function isNumber(t: TemplateToken): t is NumberToken {
  return isLiteral(t) && t.templateTokenType === TokenType.Number
}

export function isBoolean(t: TemplateToken): t is BooleanToken {
  return isLiteral(t) && t.templateTokenType === TokenType.Boolean
}

export function isBasicExpression(t: TemplateToken): t is BasicExpressionToken {
  return isScalar(t) && t.templateTokenType === TokenType.BasicExpression
}

export function isSequence(t: TemplateToken): t is SequenceToken {
  return t instanceof SequenceToken
}

export function isMapping(t: TemplateToken): t is MappingToken {
  return t instanceof MappingToken
}
