import { BooleanData, ExpressionData } from "../data";
import { toUpperSpecial } from "../result";
import { FunctionDefinition } from "./info";

export const startswith: FunctionDefinition = {
  name: "startsWith",
  description:
    "`startsWith( searchString, searchValue )`\n\nReturns `true` when `searchString` starts with `searchValue`. This function is not case sensitive. Casts values to a string.",
  minArgs: 2,
  maxArgs: 2,
  call: (...args: ExpressionData[]): ExpressionData => {
    const left = args[0];
    if (!left.primitive) {
      return new BooleanData(false);
    }

    const right = args[1];
    if (!right.primitive) {
      return new BooleanData(false);
    }

    const ls = toUpperSpecial(left.coerceString());
    const rs = toUpperSpecial(right.coerceString());

    return new BooleanData(ls.startsWith(rs));
  },
};
