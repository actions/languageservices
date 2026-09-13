import {data, DescriptionDictionary} from "@actions/expressions";
import {isParallelStep, isWaitAll, isWaitStep} from "@actions/workflow-parser/model/type-guards";
import {Step} from "@actions/workflow-parser/model/workflow-template";
import {WorkflowContext} from "../context/workflow-context.js";
import {getDescription} from "./descriptions.js";

export function getStepsContext(workflowContext: WorkflowContext): DescriptionDictionary {
  const d = new DescriptionDictionary();
  if (!workflowContext.job?.steps) {
    return d;
  }

  const currentStep = workflowContext.step?.id;
  let pendingSteps: Set<string> | undefined;

  for (const step of workflowContext.job.steps) {
    // We can't reference context from the current step or later
    // steps, so once we reach the current step, we can stop.
    if (currentStep && step.id === currentStep) {
      return d;
    }

    if (isParallelStep(step)) {
      // A step in a parallel block cannot reference other steps in that same
      // parallel block. We collect the steps in the parallel block and only add
      // them to the dictionary if the current step was not found in the block.
      const {foundCurrentStep, stepContexts} = collectParallelSteps(step.parallel, currentStep);
      if (foundCurrentStep) {
        // The current step is in this parallel block, so we stop
        // now and don't include the step contexts from the block.
        return d;
      }

      // The current step was not in the parallel block, so we can continue.
      // The steps in that block are available to be referenced from
      // future steps, so we can add them to our output.
      for (const pair of stepContexts.pairs()) {
        d.add(pair.key, pair.value, pair.description);
      }
    } else if (isWaitStep(step)) {
      // All steps that are waited on will now be
      // available, so remove them from the pending
      // steps and add them to our output.
      for (const id of step.wait) {
        if (pendingSteps?.delete(id.value)) {
          d.add(id.value, stepContext());
        }
      }
    } else if (isWaitAll(step)) {
      // All pending steps will now be available.
      if (pendingSteps) {
        for (const id of pendingSteps) {
          d.add(id, stepContext());
        }
        pendingSteps.clear();
      }
    } else if (isGenerated(step)) {
      // We only need to create a context for steps
      // with a declared ID, not a generated ID.
      continue;
    } else if ("background" in step && step.background) {
      // The step is running in the background, so we can't add
      // it to our output yet. Mark it as a pending step so
      // that we can add it to our output when it is waited on.
      pendingSteps ??= new Set();
      pendingSteps.add(step.id);
    } else {
      d.add(step.id, stepContext());
    }
  }

  // If we reached the end of the steps without finding the current
  // step, then either there isn't a current step, or it doesn't
  // exist. Either way, we'll add all the remaining pending steps
  // to the output since they will be complete after the last step.
  if (pendingSteps) {
    for (const id of pendingSteps) {
      d.add(id, stepContext());
    }
  }

  return d;
}

function collectParallelSteps(
  steps: Step[],
  currentStep: string | undefined
): {foundCurrentStep: boolean; stepContexts: DescriptionDictionary} {
  const stepContexts = new DescriptionDictionary();
  for (const step of steps) {
    // We can't reference context from the current step or later
    // steps, so once we reach the current step, we can stop.
    if (currentStep && step.id === currentStep) {
      return {foundCurrentStep: true, stepContexts};
    }

    // The `parallel`, `wait` and `wait-all` steps are not allowed
    // in a parallel block, so we only need to check if the step
    // has a generated ID. If it doesn't, then we include it.
    if (!isGenerated(step)) {
      stepContexts.add(step.id, stepContext());
    }
  }

  return {foundCurrentStep: false, stepContexts};
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
