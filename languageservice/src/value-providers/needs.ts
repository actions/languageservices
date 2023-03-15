import {WorkflowContext} from "../context/workflow-context";
import {Value} from "./config";

export function needs(context: WorkflowContext): Promise<Value[]> {
  if (!context.template) {
    return Promise.resolve([]);
  }

  const uniquejobIDs = new Set(context.template.jobs.map(j => j.id)).values();
  return Promise.resolve(
    Array.from(uniquejobIDs)
      .filter(x => x.value !== context.job?.id.value)
      .map(x => ({label: x.value}))
  );
}
