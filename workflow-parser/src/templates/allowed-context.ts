import {FunctionInfo} from "@github/actions-expressions/funcs/info";
import {MAX_CONSTANT} from "./template-constants";

export function splitAllowedContext(allowedContext: string[]): {
  namedContexts: string[];
  functions: FunctionInfo[];
} {
  const FUNCTION_REGEXP = /^([a-zA-Z0-9_]+)\(([0-9]+),([0-9]+|MAX)\)$/;

  const namedContexts: string[] = [];
  const functions: FunctionInfo[] = [];
  if (allowedContext.length > 0) {
    for (const contextItem of allowedContext) {
      const match = contextItem.match(FUNCTION_REGEXP);
      if (match) {
        const functionName = match[1];
        const minParameters = Number.parseInt(match[2]);
        const maxParametersRaw = match[3];
        const maxParameters =
          maxParametersRaw === MAX_CONSTANT ? Number.MAX_SAFE_INTEGER : Number.parseInt(maxParametersRaw);
        functions.push(<FunctionInfo>{
          name: functionName,
          minArgs: minParameters,
          maxArgs: maxParameters
        });
      } else {
        namedContexts.push(contextItem);
      }
    }
  }

  return {
    namedContexts: namedContexts,
    functions: functions
  };
}
