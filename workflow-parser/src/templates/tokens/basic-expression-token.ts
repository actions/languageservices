import {DefinitionInfo} from "../schema/definition-info.js";

import {CLOSE_EXPRESSION, OPEN_EXPRESSION} from "../template-constants.js";
import {ExpressionToken} from "./expression-token.js";
import {ScalarToken} from "./scalar-token.js";
import {SerializedExpressionToken} from "./serialization.js";
import {TemplateToken} from "./template-token.js";
import {TokenRange} from "./token-range.js";
import {TokenType} from "./types.js";

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
   * The block scalar header (e.g., "|", "|-", "|+", ">", ">-", ">+") if parsed from a YAML block scalar.
   */
  public readonly blockScalarHeader: string | undefined;

  /**
   * @param file The file ID where this token originated
   * @param range The range of the entire expression including `${{` and `}}`
   * @param expression The expression string without `${{` and `}}` markers
   * @param definitionInfo Schema definition info for this token
   * @param originalExpressions If transformed from individual expressions (e.g., format()), these are the originals
   * @param source The original source string from the YAML
   * @param expressionRange The range of just the expression, excluding `${{` and `}}`
   * @param blockScalarHeader The block scalar header (e.g., "|", "|-") if parsed from a YAML block scalar
   */
  public constructor(
    file: number | undefined,
    range: TokenRange | undefined,
    expression: string,
    definitionInfo: DefinitionInfo | undefined,
    originalExpressions: BasicExpressionToken[] | undefined,
    source: string | undefined,
    expressionRange?: TokenRange | undefined,
    blockScalarHeader?: string | undefined
  ) {
    super(TokenType.BasicExpression, file, range, undefined, definitionInfo);
    this.expr = expression;
    this.source = source;
    this.originalExpressions = originalExpressions;
    this.expressionRange = expressionRange;
    this.blockScalarHeader = blockScalarHeader;
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
          this.blockScalarHeader
        )
      : new BasicExpressionToken(
          this.file,
          this.range,
          this.expr,
          this.definitionInfo,
          this.originalExpressions,
          this.source,
          this.expressionRange,
          this.blockScalarHeader
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
