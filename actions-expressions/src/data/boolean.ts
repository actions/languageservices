import { ExpressionDataInterface, Kind } from "./expressiondata";

export class BooleanData implements ExpressionDataInterface {
  constructor(public readonly value: boolean) {}

  public readonly kind = Kind.Boolean;

  public primitive = true;

  coerceString(): string {
    if (this.value) {
      return "true";
    }

    return "false";
  }

  number(): number {
    if (this.value) {
      return 1;
    }

    return 0;
  }
}
