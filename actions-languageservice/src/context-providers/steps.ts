import {data} from "@github/actions-expressions";
import {Step} from "@github/actions-workflow-parser/model/workflow-template";
import {WorkflowContext} from "../context/workflow-context";

export function getStepsContext(workflowContext: WorkflowContext): data.Dictionary {
  const d = new data.Dictionary();
  if (!workflowContext.job?.steps) {
    return d;
  }

  const currentStep = workflowContext.step?.id;

  for (const step of workflowContext.job.steps) {
    // We can't reference context from the current step or later steps
    if (currentStep && step.id === currentStep) {
      break;
    }

    if (isGenerated(step)) {
      continue;
    }

    d.add(step.id, stepContext());
  }

  return d;
}

function stepContext(): data.Dictionary {
  // https://docs.github.com/en/actions/learn-github-actions/contexts#steps-context
  const d = new data.Dictionary();

  d.add("outputs", new data.Null());

  // Can be "success", "failure", "cancelled", or "skipped"
  d.add("conclusion", new data.Null());
  d.add("outcome", new data.Null());

  return d;
}

function isGenerated(step: Step): boolean {
  // Steps need to explicitly set an ID to be referenced in the context
  // Generated IDs always start with "__", which is not allowed by user-defined IDs
  return step.id.startsWith("__");
}
