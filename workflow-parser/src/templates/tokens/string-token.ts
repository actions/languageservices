import {Scalar} from "yaml";
import {LiteralToken, TemplateToken} from ".";
import {DefinitionInfo} from "../schema/definition-info";
import {TokenRange} from "./token-range";
import {TokenType} from "./types";

export class StringToken extends LiteralToken {
  public readonly value: string;
  public readonly source: string | undefined;
  public readonly scalarType: Scalar.Type | undefined;
  public readonly blockScalarHeader: string | undefined;

  public constructor(
    file: number | undefined,
    range: TokenRange | undefined,
    value: string,
    definitionInfo: DefinitionInfo | undefined,
    source?: string,
    scalarType?: Scalar.Type,
    blockScalarHeader?: string
  ) {
    super(TokenType.String, file, range, definitionInfo);
    this.value = value;
    this.source = source;
    this.scalarType = scalarType;
    this.blockScalarHeader = blockScalarHeader;
  }

  public override clone(omitSource?: boolean): TemplateToken {
    return omitSource
      ? new StringToken(
          undefined,
          undefined,
          this.value,
          this.definitionInfo,
          this.source,
          this.scalarType,
          this.blockScalarHeader
        )
      : new StringToken(
          this.file,
          this.range,
          this.value,
          this.definitionInfo,
          this.source,
          this.scalarType,
          this.blockScalarHeader
        );
  }

  public override toString(): string {
    return this.value;
  }

  public override toJSON() {
    return this.value;
  }
}
