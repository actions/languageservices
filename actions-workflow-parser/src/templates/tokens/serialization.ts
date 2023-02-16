import {ScalarToken} from "./scalar-token";
import {TemplateToken} from "./template-token";
import {TokenType} from "./types";

export type MapItem = {
  Key: ScalarToken;
  Value: TemplateToken;
};

export type SerializedMappingToken = {
  type: TokenType.Mapping;
  map: MapItem[];
};

export type SerializedSequenceToken = {
  type: TokenType.Sequence;
  seq: TemplateToken[];
};

export type SerializedExpressionToken = {
  type: TokenType.BasicExpression | TokenType.InsertExpression;
  expr: string;
};

export type SerializedToken =
  | SerializedMappingToken
  | SerializedSequenceToken
  | SerializedExpressionToken
  | string
  | number
  | boolean
  | null
  | undefined;
