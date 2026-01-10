import {LiteralToken, TemplateToken} from "./index.js";
import {DefinitionInfo} from "../schema/definition-info.js";
import {TokenRange} from "./token-range.js";
import {TokenType} from "./types.js";

export class StringToken extends LiteralToken {
  public readonly value: string;
  public readonly source: string | undefined;
  public readonly blockScalarHeader: string | undefined;

  public constructor(
    file: number | undefined,
    range: TokenRange | undefined,
    value: string,
    definitionInfo: DefinitionInfo | undefined,
    source?: string,
    blockScalarHeader?: string
  ) {
    super(TokenType.String, file, range, definitionInfo);
    this.value = value;
    this.source = source;
    this.blockScalarHeader = blockScalarHeader;
  }

  public override clone(omitSource?: boolean): TemplateToken {
    return omitSource
      ? new StringToken(undefined, undefined, this.value, this.definitionInfo, this.source, this.blockScalarHeader)
      : new StringToken(this.file, this.range, this.value, this.definitionInfo, this.source, this.blockScalarHeader);
  }

  public override toString(): string {
    return this.value;
  }

  public override toJSON() {
    return this.value;
  }
}
