import {data} from "@github/actions-expressions";
import {Dictionary} from "@github/actions-expressions/data/dictionary";
import {ExpressionData, Pair} from "@github/actions-expressions/data/expressiondata";
import {WorkflowContext} from "../context/workflow-context";

export type ContextProviderConfig = {
  getContext: (
    name: string,
    defaultContext: data.Dictionary | undefined,
    workflowContext: WorkflowContext
  ) => Promise<data.Dictionary | undefined>;
};

/**
 * DynamicDictionary is a dictionary that returns an empty DynamicDictionary (or other given type)
 * for any key that is not present.
 */
export class DynamicDictionary<T extends ExpressionData = Dictionary> extends data.Dictionary {
  constructor(pairs: Pair[], private creator: () => T = () => new data.Dictionary() as T) {
    super(...pairs);
  }

  get(key: string): ExpressionData | undefined {
    const value = super.get(key);
    if (value) {
      return value;
    }

    return this.creator();
  }
}
