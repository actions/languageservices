import { WorkflowTemplate } from "@github/actions-workflow-parser/model/workflow-template";

export interface Value {
  label: string;
  description?: string;
}

export type ValueProvider = () => Value[];

export interface WorkflowContext {
  uri: string;
}
export interface ValueProviderConfig {
  getCustomValues: (
    key: string,
    context: WorkflowContext,
    template: WorkflowTemplate | undefined
  ) => Promise<Value[] | undefined>;
  getActionInputs?: (
    owner: string,
    name: string,
    ref: string,
    path?: string
  ) => Promise<ActionInput[]>;
}

export interface ActionInput {
  name: string;
  description?: string;
  required?: boolean;
}
