import {TemplateToken, ScalarToken, ExpressionToken} from "./index.js";
import {DefinitionInfo} from "../schema/definition-info.js";
import {INSERT_DIRECTIVE, OPEN_EXPRESSION, CLOSE_EXPRESSION} from "../template-constants.js";
import {SerializedExpressionToken} from "./serialization.js";
import {TokenRange} from "./token-range.js";
import {TokenType} from "./types.js";

export class InsertExpressionToken extends ExpressionToken {
  public constructor(
    file: number | undefined,
    range: TokenRange | undefined,
    definitionInfo: DefinitionInfo | undefined
  ) {
    super(TokenType.InsertExpression, file, range, INSERT_DIRECTIVE, definitionInfo);
  }

  public override clone(omitSource?: boolean): TemplateToken {
    return omitSource
      ? new InsertExpressionToken(undefined, undefined, this.definitionInfo)
      : new InsertExpressionToken(this.file, this.range, this.definitionInfo);
  }

  public override toString(): string {
    return `${OPEN_EXPRESSION} ${INSERT_DIRECTIVE} ${CLOSE_EXPRESSION}`;
  }

  public override toDisplayString(): string {
    return ScalarToken.trimDisplayString(this.toString());
  }

  public override toJSON(): SerializedExpressionToken {
    return {
      type: TokenType.InsertExpression,
      expr: "insert"
    };
  }
}
