import { LiteralToken, MappingToken } from "../tokens"
import { Definition } from "./definition"

export abstract class ScalarDefinition extends Definition {
  public constructor(key: string, definition?: MappingToken) {
    super(key, definition)
  }

  public abstract isMatch(literal: LiteralToken): boolean
}
