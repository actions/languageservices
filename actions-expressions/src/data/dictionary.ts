import {ExpressionData, ExpressionDataInterface, Kind, kindStr, Pair} from "./expressiondata";

export class Dictionary implements ExpressionDataInterface {
  private keys: string[] = [];
  private v: ExpressionData[] = [];
  private indexMap: {[key: string]: number} = {};

  constructor(...pairs: Pair[]) {
    for (const p of pairs) {
      this.add(p.key, p.value);
    }
  }

  public readonly kind = Kind.Dictionary;

  public primitive = false;

  coerceString(): string {
    return kindStr(this.kind);
  }

  number(): number {
    return NaN;
  }

  add(key: string, value: ExpressionData) {
    if (key.toLowerCase() in this.indexMap) {
      return;
    }

    this.keys.push(key);
    this.v.push(value);
    this.indexMap[key.toLowerCase()] = this.v.length - 1;
  }

  get(key: string): ExpressionData | undefined {
    const index = this.indexMap[key.toLowerCase()];
    if (index === undefined) {
      return undefined;
    }

    return this.v[index];
  }

  values(): ExpressionData[] {
    return this.v;
  }

  pairs(): Pair[] {
    const result: Pair[] = [];

    for (const key of this.keys) {
      result.push({key, value: this.v[this.indexMap[key.toLowerCase()]]});
    }

    return result;
  }
}

export function isDictionary(x: ExpressionData): x is Dictionary {
  return x.kind === Kind.Dictionary;
}
