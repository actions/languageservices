import {ExpressionData} from "../data";
import {reviver} from "../data/reviver";
import {ExpressionEvaluationError} from "../errors";
import {FunctionDefinition} from "./info";

export const fromjson: FunctionDefinition = {
  name: "fromJson",
  description:
    "`fromJSON(value)`\n\nReturns a JSON object or JSON data type for `value`. You can use this function to provide a JSON object as an evaluated expression or to convert environment variables from a string.",
  minArgs: 1,
  maxArgs: 1,
  call: (...args: ExpressionData[]): ExpressionData => {
    const input = args[0];
    const is = input.coerceString();

    if (is.trim() === "") {
      throw new Error("empty input");
    }

    try {
      return JSON.parse(is, reviver) as ExpressionData;
    } catch (e) {
      throw new ExpressionEvaluationError("Error parsing JSON when evaluating fromJson", {cause: e});
    }
  }
};
