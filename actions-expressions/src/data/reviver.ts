import {Array as dArray} from "./array";
import {BooleanData} from "./boolean";
import {Dictionary} from "./dictionary";
import {ExpressionData, Pair} from "./expressiondata";
import {Null} from "./null";
import {NumberData} from "./number";
import {StringData} from "./string";

/**
 * Reviver can be passed to `JSON.parse` to convert plain JSON into an `ExpressionData` object.
 *
 * See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#reviver
 */
export function reviver(key: string, val: any): ExpressionData {
  if (val === null) {
    return new Null();
  }

  if (typeof val === "string") {
    return new StringData(val);
  }

  if (typeof val === "number") {
    return new NumberData(val);
  }

  if (typeof val === "boolean") {
    return new BooleanData(val as boolean);
  }

  if (Array.isArray(val)) {
    return new dArray(...val);
  }

  if (typeof val === "object") {
    return new Dictionary(
      ...Object.keys(val).map(
        k =>
          ({
            key: k,
            value: val[k]
          } as Pair)
      )
    );
  }

  // Pass through value
  return val;
}
