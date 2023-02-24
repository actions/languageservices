import {data, DescriptionDictionary} from "@actions/expressions";
import {StringData} from "@actions/expressions/data/string";
import {MappingToken} from "@actions/workflow-parser/templates/tokens/mapping-token";
import {WorkflowContext} from "../context/workflow-context";
import {getDescription} from "./descriptions";

export function getJobsContext(workflowContext: WorkflowContext): DescriptionDictionary {
  // https://docs.github.com/en/actions/learn-github-actions/contexts#jobs-context
  const jobsContext = new DescriptionDictionary();

  const jobs = workflowContext.template?.jobs;
  if (!jobs) {
    return jobsContext;
  }
  for (const job of jobs) {
    const jobContext = new DescriptionDictionary();
    jobContext.add("result", new data.Null(), getDescription("jobs", "result"));

    const outputs = job.outputs || new data.Null();
    if (outputs instanceof MappingToken) {
      jobContext.add("outputs", createOutputsContext(outputs), getDescription("jobs", "outputs"));
    }

    jobsContext.add(job.id.toString(), jobContext);
  }

  return jobsContext;
}

function createOutputsContext(outputs: MappingToken): DescriptionDictionary {
  const outputsContext = new DescriptionDictionary();
  for (const output of outputs) {
    outputsContext.add(
      output.key.toString(),
      new StringData(output.value.toString()),
      getDescription(output.key.toString(), "output")
    );
  }
  return outputsContext;
}
