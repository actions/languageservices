import {ExpressionData, ExpressionDataInterface, Kind, kindStr} from "./expressiondata";

export class Array implements ExpressionDataInterface {
  private v: ExpressionData[] = [];

  constructor(...data: ExpressionData[]) {
    for (const d of data) {
      this.add(d);
    }
  }

  public readonly kind = Kind.Array;

  public primitive = false;

  coerceString(): string {
    return kindStr(this.kind);
  }

  number(): number {
    return NaN;
  }

  add(value: ExpressionData) {
    this.v.push(value);
  }

  get(index: number): ExpressionData {
    return this.v[index];
  }

  values(): ExpressionData[] {
    return this.v;
  }
}
