import {data} from "@github/actions-expressions";
import {isDictionary} from "@github/actions-expressions/data/dictionary";
import {ExpressionData, Pair} from "@github/actions-expressions/data/expressiondata";

export class AccessError extends Error {
  constructor(message: string, public readonly keyName: string) {
    super(message);
  }
}

export class ErrorDictionary extends data.Dictionary {
  constructor(...pairs: Pair[]) {
    super(...pairs);
  }

  get(key: string): ExpressionData | undefined {
    const value = super.get(key);
    if (value) {
      return value;
    }

    throw new AccessError(`Invalid context access: ${key}`, key);
  }
}

export function wrapDictionary(d: data.Dictionary): ErrorDictionary {
  const e = new ErrorDictionary();

  for (const {key, value} of d.pairs()) {
    if (isDictionary(value)) {
      e.add(key, wrapDictionary(value));
    } else {
      e.add(key, value);
    }
  }

  return e;
}
