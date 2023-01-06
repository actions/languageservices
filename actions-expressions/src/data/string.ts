import { ExpressionDataInterface, Kind } from "./expressiondata";

export class StringData implements ExpressionDataInterface {
  constructor(public readonly value: string) {}

  public readonly kind = Kind.String;

  public primitive = true;

  coerceString(): string {
    return this.value;
  }

  number(): number {
    return Number(this.value);
  }
}
