import {Dictionary} from "./dictionary.js";
import {Null} from "./null.js";
import {Array} from "./array.js";
import {StringData} from "./string.js";
import {NumberData} from "./number.js";
import {BooleanData} from "./boolean.js";

export enum Kind {
  String = 0,
  Array,
  Dictionary,
  Boolean,
  Number,
  CaseSensitiveDictionary,
  Null
}

export function kindStr(k: Kind): string {
  switch (k) {
    case Kind.Array:
      return "Array";
    case Kind.Boolean:
      return "Boolean";
    case Kind.Null:
      return "Null";
    case Kind.Number:
      return "Number";
    case Kind.Dictionary:
      return "Object";
    case Kind.String:
      return "String";
  }

  return "unknown";
}

export interface ExpressionDataInterface {
  kind: Kind;
  primitive: boolean;

  coerceString(): string;

  number(): number;
}

export type ExpressionData = Array | Dictionary | StringData | BooleanData | NumberData | Null;

export type Pair = {
  key: string;
  value: ExpressionData;
};
