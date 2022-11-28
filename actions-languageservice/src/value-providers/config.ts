import {WorkflowContext} from "../context/workflow-context";

export interface Value {
  label: string;
  description?: string;
}

export type ValueProvider = (context: WorkflowContext) => Promise<Value[]>;

export interface ValueProviderConfig {
  [definitionKey: string]: ValueProvider;
}
