import {ExpressionDataInterface, Kind} from "./expressiondata";

export class Null implements ExpressionDataInterface {
  public readonly kind = Kind.Null;

  public primitive = true;

  coerceString(): string {
    return "";
  }

  number(): number {
    return 0;
  }
}
