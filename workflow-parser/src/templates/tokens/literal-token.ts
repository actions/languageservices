import {DefinitionInfo} from "../schema/definition-info";
import {ScalarToken} from "./scalar-token";
import {TokenRange} from "./token-range";

export abstract class LiteralToken extends ScalarToken {
  public constructor(
    type: number,
    file: number | undefined,
    range: TokenRange | undefined,
    definitionInfo: DefinitionInfo | undefined
  ) {
    super(type, file, range, definitionInfo);
  }

  public override get isLiteral(): boolean {
    return true;
  }

  public override get isExpression(): boolean {
    return false;
  }

  public override toDisplayString(): string {
    return ScalarToken.trimDisplayString(this.toString());
  }

  /**
   * Throws a good debug message when an unexpected literal value is encountered
   */
  public assertUnexpectedValue(objectDescription: string): void {
    throw new Error(`Error while reading '${objectDescription}'. Unexpected value '${this.toString()}'`);
  }
}
