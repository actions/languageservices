import {WorkflowContext} from "@github/actions-languageservice/context/workflow-context";
import {convertWorkflowTemplate, parseWorkflow, TraceWriter} from "@github/actions-workflow-parser";
import {isJob} from "@github/actions-workflow-parser/model/type-guards";

const nullTrace: TraceWriter = {
  info: x => {},
  verbose: x => {},
  error: x => {}
};

export async function createWorkflowContext(
  workflow: string,
  job?: string,
  stepIndex?: number
): Promise<WorkflowContext> {
  const parsed = parseWorkflow({name: "test.yaml", content: workflow}, nullTrace);
  if (!parsed.value) {
    throw new Error("Failed to parse workflow");
  }
  const template = await convertWorkflowTemplate("test.yaml", parsed.context, parsed.value);
  const context: WorkflowContext = {uri: "test.yaml", template};

  if (job) {
    const workflowJob = template.jobs.find(j => j.id.value === job);
    if (workflowJob) {
      if (isJob(workflowJob)) {
        context.job = workflowJob;
      } else {
        context.reusableWorkflowJob = workflowJob;
      }
    }
  }

  if (stepIndex !== undefined) {
    context.step = context.job?.steps[stepIndex];
  }

  return context;
}
