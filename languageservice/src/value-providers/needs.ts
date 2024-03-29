import {WorkflowContext} from "../context/workflow-context";
import {Value} from "./config";

export function needs(context: WorkflowContext): Value[] {
  if (!context.template) {
    return [];
  }

  const uniquejobIDs = new Set(context.template.jobs.map(j => j.id)).values();
  return Array.from(uniquejobIDs)
    .filter(x => x.value !== context.job?.id.value)
    .map(x => ({label: x.value}));
}
