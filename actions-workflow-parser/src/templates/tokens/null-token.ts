import { LiteralToken, TemplateToken } from "."
import { DefinitionInfo } from "../schema/definition-info"
import { TokenRange } from "./token-range"
import { TokenType } from "./types"

export class NullToken extends LiteralToken {
  public constructor(
    file: number | undefined,
    range: TokenRange | undefined,
    definitionInfo: DefinitionInfo | undefined
  ) {
    super(TokenType.Null, file, range, definitionInfo)
  }

  public override clone(omitSource?: boolean): TemplateToken {
    return omitSource
      ? new NullToken(undefined, undefined, this.definitionInfo)
      : new NullToken(this.file, this.range, this.definitionInfo)
  }

  public override toString(): string {
    return ""
  }

  public override toJSON() {
    return "null"
  }
}
