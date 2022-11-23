import {WorkflowTemplate} from "@github/actions-workflow-parser/model/workflow-template";
import {Value} from "./config";

export function getJobNames(template: WorkflowTemplate | undefined): Value[] {
  if (!template) {
    return [];
  }

  const uniquejobIDs = new Set(template.jobs.map(j => j.id)).values();
  return Array.from(uniquejobIDs).map(x => ({label: x}));
}
