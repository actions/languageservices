import {WorkflowContext} from "../context/workflow-context";
import {Value} from "./config";

export async function needs(context: WorkflowContext): Promise<Value[]> {
  if (!context.template) {
    return [];
  }

  const uniquejobIDs = new Set(context.template.jobs.map(j => j.id)).values();
  return Array.from(uniquejobIDs)
    .filter(x => x !== context.job?.id)
    .map(x => ({label: x}));
}
