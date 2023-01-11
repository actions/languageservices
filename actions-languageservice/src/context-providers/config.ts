import {DescriptionDictionary} from "@github/actions-expressions";
import {WorkflowContext} from "../context/workflow-context";

export type ContextProviderConfig = {
  getContext: (
    name: string,
    defaultContext: DescriptionDictionary | undefined,
    workflowContext: WorkflowContext
  ) => Promise<DescriptionDictionary | undefined>;
};
