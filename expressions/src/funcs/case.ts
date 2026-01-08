import {BooleanData, ExpressionData, Kind} from "../data/index.js";
import {FunctionDefinition} from "./info.js";

export const caseFunc: FunctionDefinition = {
  name: "case",
  description:
    "`case( pred1, val1, pred2, val2, ..., default )`\n\nEvaluates predicates in order and returns the value corresponding to the first predicate that evaluates to `true`. If no predicate matches, returns the default value (the last argument).",
  minArgs: 3,
  maxArgs: Number.MAX_SAFE_INTEGER,
  call: (...args: ExpressionData[]): ExpressionData => {
    // Evaluate predicate-result pairs
    for (let i = 0; i < args.length - 1; i += 2) {
      const predicate = args[i];

      // Predicate must be a boolean
      if (predicate.kind !== Kind.Boolean) {
        throw new Error("case predicate must evaluate to a boolean value");
      }

      // If predicate is true, return the corresponding result
      if ((predicate as BooleanData).value) {
        return args[i + 1];
      }
    }

    // No predicate matched, return default (last argument)
    return args[args.length - 1];
  }
};
