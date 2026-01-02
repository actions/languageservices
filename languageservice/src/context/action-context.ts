import {isMapping} from "@actions/workflow-parser";
import {ActionInputDefinition, ActionTemplate} from "@actions/workflow-parser/actions/action-template";
import {Step} from "@actions/workflow-parser/model/workflow-template";
import {MappingToken} from "@actions/workflow-parser/templates/tokens/mapping-token";
import {SequenceToken} from "@actions/workflow-parser/templates/tokens/sequence-token";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";

/**
 * Context information for an action.yml file, used to provide
 * expression completion with action-specific values.
 */
export interface ActionContext {
  uri: string;

  /** The converted action template */
  template: ActionTemplate | undefined;

  /** If the context is for a position within a composite step, this will be the step */
  step?: Step;
}

/**
 * Build context from a converted action template and token path.
 * Similar to getWorkflowContext but for action files.
 */
export function getActionContext(
  uri: string,
  template: ActionTemplate | undefined,
  tokenPath: TemplateToken[]
): ActionContext {
  const context: ActionContext = {uri, template};
  if (!template) {
    return context;
  }

  // Only composite actions have steps
  if (template.runs?.using !== "composite") {
    return context;
  }

  const compositeRuns = template.runs;
  if (!compositeRuns.steps?.length) {
    return context;
  }

  // Find the current step from the token path
  let stepsSequence: SequenceToken | undefined;
  let stepToken: MappingToken | undefined;

  for (const token of tokenPath) {
    const defKey = token.definition?.key;
    if (defKey === "composite-steps" && token instanceof SequenceToken) {
      stepsSequence = token;
    } else if ((defKey === "run-step" || defKey === "uses-step") && isMapping(token)) {
      stepToken = token;
    }
  }

  if (stepsSequence && stepToken) {
    context.step = findStep(compositeRuns.steps, stepsSequence, stepToken);
  }

  return context;
}

/**
 * Find the Step that corresponds to the given step token.
 */
function findStep(steps: Step[], stepsSequence: SequenceToken, stepToken: MappingToken): Step | undefined {
  // Find the step by matching index in the sequence
  let stepIndex = -1;
  for (let i = 0; i < stepsSequence.count; i++) {
    if (stepsSequence.get(i) === stepToken) {
      stepIndex = i;
      break;
    }
  }

  if (stepIndex === -1 || stepIndex >= steps.length) {
    return undefined;
  }

  return steps[stepIndex];
}

/**
 * Get input definitions from the action template.
 */
export function getActionInputs(template: ActionTemplate | undefined): ActionInputDefinition[] {
  return template?.inputs ?? [];
}

/**
 * Get step IDs from composite action steps that appear before the current step.
 * This is used for `steps.<id>` context completion - you can only reference
 * steps that have already run.
 */
export function getActionStepIdsBefore(context: ActionContext): string[] {
  const template = context.template;
  if (!template || template.runs?.using !== "composite") {
    return [];
  }

  const compositeRuns = template.runs;
  const steps = compositeRuns.steps ?? [];
  const currentStep = context.step;

  const stepIds: string[] = [];
  for (const step of steps) {
    // Stop when we reach the current step
    if (currentStep && step === currentStep) {
      break;
    }

    // Only include steps with explicit IDs
    if (step.id) {
      stepIds.push(step.id);
    }
  }

  return stepIds;
}
