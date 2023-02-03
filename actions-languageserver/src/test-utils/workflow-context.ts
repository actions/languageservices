import {WorkflowContext} from "@github/actions-languageservice/context/workflow-context";
import {convertWorkflowTemplate, parseWorkflow, TraceWriter} from "@github/actions-workflow-parser";
import {isJob} from "@github/actions-workflow-parser/model/type-guards";

const nullTrace: TraceWriter = {
  info: x => {},
  verbose: x => {},
  error: x => {}
};

export function createWorkflowContext(workflow: string, job?: string, stepIndex?: number): WorkflowContext {
  const parsed = parseWorkflow("test.yaml", [{name: "test.yaml", content: workflow}], nullTrace);
  if (!parsed.value) {
    throw new Error("Failed to parse workflow");
  }
  const template = convertWorkflowTemplate(parsed.context, parsed.value);
  const context: WorkflowContext = {uri: "test.yaml", template};

  if (job) {
    context.job = template.jobs.find(j => j.id.value === job);
  }

  if (stepIndex !== undefined && context.job && isJob(context.job)) {
    context.step = context.job.steps[stepIndex];
  }

  return context;
}
