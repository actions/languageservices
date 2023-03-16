import {ExpressionDataInterface, Kind} from "./expressiondata";

export class NumberData implements ExpressionDataInterface {
  constructor(public readonly value: number) {}

  public readonly kind = Kind.Number;

  public primitive = true;

  coerceString(): string {
    if (this.value === 0) {
      return "0";
    }

    // Workaround to limit the precision to at most 15 digits. Format the number to a string, then parse
    // it back to a number to remove trailing zeroes to prevent numbers to be converted to 1.200000000...
    return (+this.value.toFixed(15)).toString();
  }

  number(): number {
    return this.value;
  }
}
