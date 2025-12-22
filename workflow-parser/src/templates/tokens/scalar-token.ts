import {DefinitionInfo} from "../schema/definition-info.js";
import {TemplateToken} from "./template-token.js";
import {TokenRange} from "./token-range.js";

/**
 * Base class for everything that is not a mapping or sequence
 */
export abstract class ScalarToken extends TemplateToken {
  public constructor(
    type: number,
    file: number | undefined,
    range: TokenRange | undefined,
    definitionInfo: DefinitionInfo | undefined
  ) {
    super(type, file, range, definitionInfo);
  }

  public abstract toString(): string;

  public abstract toDisplayString(): string;

  public override get isScalar(): boolean {
    return true;
  }

  protected static trimDisplayString(displayString: string): string {
    let firstLine = displayString.trimStart();
    const firstNewLine = firstLine.indexOf("\n");
    const firstCarriageReturn = firstLine.indexOf("\r");
    if (firstNewLine >= 0 || firstCarriageReturn >= 0) {
      firstLine = firstLine.substr(
        0,
        Math.min(
          firstNewLine >= 0 ? firstNewLine : Number.MAX_VALUE,
          firstCarriageReturn >= 0 ? firstCarriageReturn : Number.MAX_VALUE
        )
      );
    }
    return firstLine;
  }
}
