export enum TokenType {
  String = 0,
  Sequence,
  Mapping,
  BasicExpression,
  InsertExpression,
  Boolean,
  Number,
  Null,
}

export function tokenTypeName(type: TokenType): string {
  switch (type) {
    case TokenType.String:
      return "StringToken"
    case TokenType.Sequence:
      return "SequenceToken"
    case TokenType.Mapping:
      return "MappingToken"
    case TokenType.BasicExpression:
      return "BasicExpressionToken"
    case TokenType.InsertExpression:
      return "InsertExpressionToken"
    case TokenType.Boolean:
      return "BooleanToken"
    case TokenType.Number:
      return "NumberToken"
    case TokenType.Null:
      return "NullToken"
    default: {
      // Use never to ensure exhaustiveness
      const exhaustiveCheck: never = type
      throw new Error(`Unhandled token type: ${type} ${exhaustiveCheck}}`)
    }
  }
}
