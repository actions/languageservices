import { Array, BooleanData, ExpressionData, Kind } from "../data";
import { equals } from "../result";
import { FunctionDefinition } from "./info";

export const contains: FunctionDefinition = {
  name: "contains",
  description:
    "`contains( search, item )`\n\nReturns `true` if `search` contains `item`. If `search` is an array, this function returns `true` if the `item` is an element in the array. If `search` is a string, this function returns `true` if the `item` is a substring of `search`. This function is not case sensitive. Casts values to a string.",
  minArgs: 2,
  maxArgs: 2,
  call: (...args: ExpressionData[]): ExpressionData => {
    const left = args[0];
    const right = args[1];

    if (left.primitive) {
      const ls = left.coerceString();
      if (right.primitive) {
        const rs = right.coerceString();
        return new BooleanData(ls.toLowerCase().includes(rs.toLowerCase()));
      }
    } else if (left.kind === Kind.Array) {
      const la = left as Array;
      if (la.values().length === 0) {
        return new BooleanData(false);
      }

      for (const v of la.values()) {
        if (equals(right, v)) {
          return new BooleanData(true);
        }
      }
    }

    return new BooleanData(false);
  },
};
