import {DefinitionInfo} from "../schema/definition-info";

import {CLOSE_EXPRESSION, OPEN_EXPRESSION} from "../template-constants";
import {ExpressionToken} from "./expression-token";
import {ScalarToken} from "./scalar-token";
import {SerializedExpressionToken} from "./serialization";
import {TemplateToken} from "./template-token";
import {TokenRange} from "./token-range";
import {TokenType} from "./types";

export class BasicExpressionToken extends ExpressionToken {
  private readonly expr: string;

  public readonly originalExpressions: BasicExpressionToken[] | undefined;

  public readonly source: string;

  /**
   * @param originalExpressions If the basic expression was transformed from individual expressions, these will be the original ones
   */
  public constructor(
    file: number | undefined,
    range: TokenRange | undefined,
    expression: string,
    definitionInfo: DefinitionInfo | undefined,
    originalExpressions: BasicExpressionToken[] | undefined,
    source: string
  ) {
    super(TokenType.BasicExpression, file, range, undefined, definitionInfo);
    this.expr = expression;
    this.originalExpressions = originalExpressions;
    this.source = source;
  }

  public get expression(): string {
    return this.expr;
  }

  public override clone(omitSource?: boolean): TemplateToken {
    return omitSource
      ? new BasicExpressionToken(
          undefined,
          undefined,
          this.expr,
          this.definitionInfo,
          this.originalExpressions,
          this.source
        )
      : new BasicExpressionToken(
          this.file,
          this.range,
          this.expr,
          this.definitionInfo,
          this.originalExpressions,
          this.source
        );
  }

  public override toString(): string {
    return `${OPEN_EXPRESSION} ${this.expr} ${CLOSE_EXPRESSION}`;
  }

  public override toDisplayString(): string {
    // TODO: Implement expression display string to match `BasicExpressionToken#ToDisplayString()` in the C# parser
    return ScalarToken.trimDisplayString(this.toString());
  }

  public override toJSON(): SerializedExpressionToken {
    return {
      type: TokenType.BasicExpression,
      expr: this.expr
    };
  }
}
