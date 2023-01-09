import { ExpressionData } from "../data";

export interface FunctionInfo {
  name: string;

  description?: string;

  minArgs: number;
  maxArgs: number;
}

export interface FunctionDefinition extends FunctionInfo {
  call: (...args: ExpressionData[]) => ExpressionData;
}
