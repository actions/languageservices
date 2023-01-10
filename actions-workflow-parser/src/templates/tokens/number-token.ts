import {LiteralToken, TemplateToken} from ".";
import {DefinitionInfo} from "../schema/definition-info";
import {TokenRange} from "./token-range";
import {TokenType} from "./types";

export class NumberToken extends LiteralToken {
  private readonly num: number;

  public constructor(
    file: number | undefined,
    range: TokenRange | undefined,
    value: number,
    definitionInfo: DefinitionInfo | undefined
  ) {
    super(TokenType.Number, file, range, definitionInfo);
    this.num = value;
  }

  public get value(): number {
    return this.num;
  }

  public override clone(omitSource?: boolean): TemplateToken {
    return omitSource
      ? new NumberToken(undefined, undefined, this.num, this.definitionInfo)
      : new NumberToken(this.file, this.range, this.num, this.definitionInfo);
  }

  public override toString(): string {
    return `${this.num}`;
  }

  public override toJSON() {
    return this.num;
  }
}
