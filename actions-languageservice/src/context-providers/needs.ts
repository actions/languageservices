import {data} from "@github/actions-expressions";
import {isString} from "@github/actions-workflow-parser/.";
import {Job} from "@github/actions-workflow-parser/model/workflow-template";
import {WorkflowContext} from "../context/workflow-context";

export function getNeedsContext(workflowContext: WorkflowContext): data.Dictionary {
  const d = new data.Dictionary();
  if (!workflowContext.job || !workflowContext.job.needs) {
    return d;
  }

  for (const jobID of workflowContext.job.needs) {
    const job = workflowContext.template?.jobs.find(job => job.id.value === jobID);
    d.add(jobID, needsJobContext(job));
  }

  return d;
}

function needsJobContext(job?: Job): data.Dictionary {
  // https://docs.github.com/en/actions/learn-github-actions/contexts#needs-context
  const d = new data.Dictionary();

  // Once job config contains outputs, this can be populated
  d.add("outputs", jobOutputs(job));

  // Can be "success", "failure", "cancelled", or "skipped"
  d.add("result", new data.Null());
  return d;
}

function jobOutputs(job?: Job): data.Dictionary {
  const d = new data.Dictionary();
  if (!job?.outputs) {
    return d;
  }

  for (let i = 0; i < job.outputs.count; ++i) {
    const output = job.outputs.get(i);
    if (!isString(output.key)) {
      continue;
    }
    d.add(output.key.value, new data.Null());
  }
  return d;
}
