import {data, DescriptionDictionary} from "@github/actions-expressions";
import {isMapping, isScalar, isString} from "@github/actions-workflow-parser";
import {isJob} from "@github/actions-workflow-parser/model/type-guards";
import {WorkflowJob} from "@github/actions-workflow-parser/model/workflow-template";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {WorkflowContext} from "../context/workflow-context";

export function getNeedsContext(workflowContext: WorkflowContext): DescriptionDictionary {
  const d = new DescriptionDictionary();

  const job = workflowContext.job || workflowContext.reusableWorkflowJob;

  if (!job?.needs) {
    return d;
  }

  for (const jobID of job.needs) {
    const job = workflowContext.template?.jobs.find(job => job.id.value === jobID.value);
    d.add(jobID.value, needsJobContext(job));
  }

  return d;
}

function needsJobContext(job?: WorkflowJob): DescriptionDictionary {
  // https://docs.github.com/en/actions/learn-github-actions/contexts#needs-context
  const d = new DescriptionDictionary();

  if (job) {
    d.add("outputs", jobOutputs(job));
  }

  // Can be "success", "failure", "cancelled", or "skipped"
  d.add("result", new data.Null());
  return d;
}

function jobOutputs(job?: WorkflowJob): DescriptionDictionary {
  const d = new DescriptionDictionary();
  if (!job?.outputs) {
    return d;
  }

  for (const output of job.outputs) {
    if (!isString(output.key)) {
      continue;
    }

    d.add(output.key.value, ...jobOutput(job, output.value));
  }
  return d;
}

function jobOutput(job: WorkflowJob, outputValue: TemplateToken): [data.ExpressionData, string | undefined] {
  if (isJob(job)) {
    // A regular workflow job won't have a description
    return isScalar(outputValue)
      ? [new data.StringData(outputValue.toDisplayString()), undefined]
      : [new data.Null(), undefined];
  }

  if (!isMapping(outputValue)) {
    return [new data.Null(), undefined];
  }

  const description = outputValue.find("description");
  const value = outputValue.find("value");

  return [
    value && isScalar(value) ? new data.StringData(value.toDisplayString()) : new data.Null(),
    description && isString(description) ? description.value : undefined
  ];
}
