import {Scalar} from "yaml";
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

  public readonly source: string | undefined;

  public readonly originalExpressions: BasicExpressionToken[] | undefined;

  /**
   * The range of the expression within the source string.
   *
   * `range` is the range of the entire expression, including the `${{` and `}}`. `expression` is only the expression
   * without any ${{ }} markers. `expressionRange` is the range of just the expression within the document.
   */
  public readonly expressionRange: TokenRange | undefined;

  /**
   * The YAML scalar type (e.g., BLOCK_LITERAL, BLOCK_FOLDED, PLAIN, etc.) if the expression was parsed from a block scalar.
   */
  public readonly scalarType: Scalar.Type | undefined;

  /**
   * The chomp style of the block scalar: 'clip' (default, keeps one newline), 'strip' (removes all), or 'keep' (keeps all).
   */
  public readonly chompStyle: "clip" | "strip" | "keep" | undefined;

  /**
   * @param originalExpressions If the basic expression was transformed from individual expressions, these will be the original ones
   */
  public constructor(
    file: number | undefined,
    range: TokenRange | undefined,
    expression: string,
    definitionInfo: DefinitionInfo | undefined,
    originalExpressions: BasicExpressionToken[] | undefined,
    source: string | undefined,
    expressionRange?: TokenRange | undefined,
    scalarType?: Scalar.Type | undefined,
    chompStyle?: "clip" | "strip" | "keep" | undefined
  ) {
    super(TokenType.BasicExpression, file, range, undefined, definitionInfo);
    this.expr = expression;
    this.source = source;
    this.originalExpressions = originalExpressions;
    this.expressionRange = expressionRange;
    this.scalarType = scalarType;
    this.chompStyle = chompStyle;
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
          this.source,
          this.expressionRange,
          this.scalarType,
          this.chompStyle
        )
      : new BasicExpressionToken(
          this.file,
          this.range,
          this.expr,
          this.definitionInfo,
          this.originalExpressions,
          this.source,
          this.expressionRange,
          this.scalarType,
          this.chompStyle
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
