import {data, DescriptionDictionary} from "@actions/expressions";
import {Step} from "@actions/workflow-parser/model/workflow-template";
import {WorkflowContext} from "../context/workflow-context";
import {getDescription} from "./descriptions";

export function getStepsContext(workflowContext: WorkflowContext): DescriptionDictionary {
  const d = new DescriptionDictionary();
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

function stepContext(): DescriptionDictionary {
  // https://docs.github.com/en/actions/learn-github-actions/contexts#steps-context
  const d = new DescriptionDictionary();

  // Step outputs are dynamic - actions can generate outputs based on their inputs
  const outputs = new DescriptionDictionary();
  outputs.complete = false;
  d.add("outputs", outputs, getDescription("steps", "outputs"));

  // Can be "success", "failure", "cancelled", or "skipped"
  d.add("conclusion", new data.Null(), getDescription("steps", "conclusion"));
  d.add("outcome", new data.Null(), getDescription("steps", "outcome"));

  return d;
}

function isGenerated(step: Step): boolean {
  // Steps need to explicitly set an ID to be referenced in the context
  // Generated IDs always start with "__", which is not allowed by user-defined IDs
  return step.id.startsWith("__");
}
