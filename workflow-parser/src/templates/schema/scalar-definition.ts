import {LiteralToken, MappingToken} from "../tokens/index.js";
import {Definition} from "./definition.js";

export abstract class ScalarDefinition extends Definition {
  public constructor(key: string, definition?: MappingToken) {
    super(key, definition);
  }

  public abstract isMatch(literal: LiteralToken): boolean;
}
