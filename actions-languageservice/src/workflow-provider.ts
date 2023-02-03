import {File} from "@github/actions-workflow-parser/workflows/file";

export type WorkflowProvider = {
  getWorkflow: (name: string) => Promise<File | undefined>;
};
