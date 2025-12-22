import {BooleanData, ExpressionData} from "../data/index.js";
import {toUpperSpecial} from "../result.js";
import {FunctionDefinition} from "./info.js";

export const endswith: FunctionDefinition = {
  name: "endsWith",
  description:
    "`endsWith( searchString, searchValue )`\n\nReturns `true` if `searchString` ends with `searchValue`. This function is not case sensitive. Casts values to a string.",
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

    return new BooleanData(ls.endsWith(rs));
  }
};
