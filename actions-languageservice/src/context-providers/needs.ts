import {data} from "@github/actions-expressions/.";
import {WorkflowContext} from "../context/workflow-context";

export function getNeedsContext(workflowContext: WorkflowContext): data.Dictionary {
  const d = new data.Dictionary();
  if (!workflowContext.job || !workflowContext.job.needs) {
    return d;
  }

  for (const job of workflowContext.job.needs) {
    d.add(job, defaultNeedsValues());
  }

  return d;
}

function defaultNeedsValues(): data.Dictionary {
  // https://docs.github.com/en/actions/learn-github-actions/contexts#needs-context
  const d = new data.Dictionary();

  // Once job config contains outputs, this can be populated
  d.add("outputs", new data.Null());

  // Can be "success", "failure", "cancelled", or "skipped"
  d.add("result", new data.Null());
  return d;
}
