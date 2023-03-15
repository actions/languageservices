import {Array} from "./array";
import {BooleanData} from "./boolean";
import {Dictionary} from "./dictionary";
import {Null} from "./null";
import {NumberData} from "./number";
import {StringData} from "./string";

/**
 * Replacer can be passed to JSON.stringify to convert an ExpressionData object into plain JSON
 *
 * See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#replacer
 */
export function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Null) {
    return null;
  }

  if (value instanceof BooleanData) {
    return value.value;
  }

  if (value instanceof NumberData) {
    return value.number();
  }

  if (value instanceof StringData) {
    return value.coerceString();
  }

  if (value instanceof Array) {
    return value.values();
  }

  if (value instanceof Dictionary) {
    const pairs = value.pairs();

    const r: Record<string, unknown> = {};
    for (const p of pairs) {
      r[p.key] = p.value;
    }

    return r;
  }

  return value;
}
