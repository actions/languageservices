import {DescriptionDictionary} from "@actions/expressions";
import {WorkflowContext} from "../context/workflow-context.js";
import {Mode} from "./default.js";

export type ContextProviderConfig = {
  getContext: (
    name: string,
    defaultContext: DescriptionDictionary | undefined,
    workflowContext: WorkflowContext,
    mode: Mode
  ) => Promise<DescriptionDictionary | undefined>;
};
