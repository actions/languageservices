import {TemplateToken} from "./index.js";
import {DefinitionInfo} from "../schema/definition-info.js";
import {SerializedSequenceToken} from "./serialization.js";
import {TokenRange} from "./token-range.js";
import {TokenType} from "./types.js";

export class SequenceToken extends TemplateToken {
  private readonly seq: TemplateToken[] = [];

  public constructor(
    file: number | undefined,
    range: TokenRange | undefined,
    definitionInfo: DefinitionInfo | undefined
  ) {
    super(TokenType.Sequence, file, range, definitionInfo);
  }

  public get count(): number {
    return this.seq.length;
  }

  public override get isScalar(): boolean {
    return false;
  }

  public override get isLiteral(): boolean {
    return false;
  }

  public override get isExpression(): boolean {
    return false;
  }

  public add(value: TemplateToken): void {
    this.seq.push(value);
  }

  public get(index: number): TemplateToken {
    return this.seq[index];
  }

  public override clone(omitSource?: boolean): TemplateToken {
    const result = omitSource
      ? new SequenceToken(undefined, undefined, this.definitionInfo)
      : new SequenceToken(this.file, this.range, this.definitionInfo);
    for (const item of this.seq) {
      result.add(item.clone(omitSource));
    }
    return result;
  }

  public override toJSON(): SerializedSequenceToken {
    return {
      type: TokenType.Sequence,
      seq: this.seq
    };
  }

  public *[Symbol.iterator](): Iterator<TemplateToken> {
    for (const item of this.seq) {
      yield item;
    }
  }
}
