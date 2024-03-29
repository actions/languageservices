import {LiteralToken, TemplateToken} from ".";
import {DefinitionInfo} from "../schema/definition-info";
import {TokenRange} from "./token-range";
import {TokenType} from "./types";

export class BooleanToken extends LiteralToken {
  private readonly bool: boolean;

  public constructor(
    file: number | undefined,
    range: TokenRange | undefined,
    value: boolean,
    definitionInfo: DefinitionInfo | undefined
  ) {
    super(TokenType.Boolean, file, range, definitionInfo);
    this.bool = value;
  }

  public get value(): boolean {
    return this.bool;
  }

  public override clone(omitSource?: boolean): TemplateToken {
    return omitSource
      ? new BooleanToken(undefined, undefined, this.bool, this.definitionInfo)
      : new BooleanToken(this.file, this.range, this.bool, this.definitionInfo);
  }

  public override toString(): string {
    return this.bool ? "true" : "false";
  }

  public override toJSON() {
    return this.bool;
  }
}
