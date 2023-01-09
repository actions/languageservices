import { LiteralToken, TemplateToken } from "."
import { DefinitionInfo } from "../schema/definition-info"
import { TokenRange } from "./token-range"
import { TokenType } from "./types"

export class StringToken extends LiteralToken {
  public readonly value: string
  public readonly source: string | undefined

  public constructor(
    file: number | undefined,
    range: TokenRange | undefined,
    value: string,
    definitionInfo: DefinitionInfo | undefined,
    source?: string
  ) {
    super(TokenType.String, file, range, definitionInfo)
    this.value = value
    this.source = source
  }

  public override clone(omitSource?: boolean): TemplateToken {
    return omitSource
      ? new StringToken(
          undefined,
          undefined,
          this.value,
          this.definitionInfo,
          this.source
        )
      : new StringToken(
          this.file,
          this.range,
          this.value,
          this.definitionInfo,
          this.source
        )
  }

  public override toString(): string {
    return this.value
  }

  public override toJSON() {
    return this.value
  }
}
