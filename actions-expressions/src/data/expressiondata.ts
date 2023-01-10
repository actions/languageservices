import {Dictionary} from "./dictionary";
import {Null} from "./null";
import {Array} from "./array";
import {StringData} from "./string";
import {NumberData} from "./number";
import {BooleanData} from "./boolean";

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
