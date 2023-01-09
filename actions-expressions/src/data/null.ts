import {
  ExpressionData,
  ExpressionDataInterface,
  Kind,
} from "./expressiondata";

export class Null implements ExpressionDataInterface {
  constructor() {}

  public readonly kind = Kind.Null;

  public primitive = true;

  coerceString(): string {
    return "";
  }

  number(): number {
    return 0;
  }
}
