import {DescriptionDictionary} from "@github/actions-expressions";
import {WorkflowContext} from "../context/workflow-context";
import {Mode} from "./default";

export type ContextProviderConfig = {
  getContext: (
    name: string,
    defaultContext: DescriptionDictionary | undefined,
    workflowContext: WorkflowContext,
    mode: Mode
  ) => Promise<DescriptionDictionary | undefined>;
};
