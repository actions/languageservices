import {WorkflowContext} from "../context/workflow-context";

export interface Value {
  label: string;
  description?: string;
}

export enum ValueProviderKind {
  AllowedValues,
  SuggestedValues
}

export type ValueProvider = {
  kind: ValueProviderKind;
  get: (context: WorkflowContext) => Promise<Value[]>;
};

export interface ValueProviderConfig {
  [definitionKey: string]: ValueProvider;
}
