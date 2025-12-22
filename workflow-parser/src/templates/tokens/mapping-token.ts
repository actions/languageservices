import {TemplateToken, KeyValuePair, ScalarToken} from "./index.js";
import {DefinitionInfo} from "../schema/definition-info.js";
import {MapItem, SerializedToken} from "./serialization.js";
import {TokenRange} from "./token-range.js";
import {TokenType} from "./types.js";

export class MappingToken extends TemplateToken {
  private readonly map: KeyValuePair[] = [];

  public constructor(
    file: number | undefined,
    range: TokenRange | undefined,
    definitionInfo: DefinitionInfo | undefined
  ) {
    super(TokenType.Mapping, file, range, definitionInfo);
  }

  public get count(): number {
    return this.map.length;
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

  public add(key: ScalarToken, value: TemplateToken): void {
    this.map.push(new KeyValuePair(key, value));
  }

  public get(index: number): KeyValuePair {
    return this.map[index];
  }

  public find(key: string): TemplateToken | undefined {
    const pair = this.map.find(pair => pair.key.toString() === key);
    return pair?.value;
  }

  public remove(index: number): void {
    this.map.splice(index, 1);
  }

  public override clone(omitSource?: boolean): TemplateToken {
    const result = omitSource
      ? new MappingToken(undefined, undefined, this.definitionInfo)
      : new MappingToken(this.file, this.range, this.definitionInfo);
    for (const item of this.map) {
      result.add(item.key.clone(omitSource) as ScalarToken, item.value.clone(omitSource));
    }
    return result;
  }

  public override toJSON(): SerializedToken {
    const items: MapItem[] = [];
    for (const item of this.map) {
      items.push({Key: item.key, Value: item.value});
    }
    return {
      type: TokenType.Mapping,
      map: items
    };
  }

  public *[Symbol.iterator](): Iterator<KeyValuePair> {
    for (const item of this.map) {
      yield item;
    }
  }
}
