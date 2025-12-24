import {data, DescriptionDictionary, isDescriptionDictionary} from "@actions/expressions";
import {parseActionReference} from "@actions/languageservice/action";
import {WorkflowContext} from "@actions/languageservice/context/workflow-context";
import {isActionStep} from "@actions/workflow-parser/model/type-guards";
import {Octokit} from "@octokit/rest";
import {TTLCache} from "../utils/cache.js";
import {getActionOutputs} from "./action-outputs.js";

export async function getStepsContext(
  octokit: Octokit,
  cache: TTLCache,
  defaultContext: DescriptionDictionary | undefined,
  workflowContext: WorkflowContext
): Promise<DescriptionDictionary | undefined> {
  if (!defaultContext || !workflowContext.job) {
    return defaultContext;
  }

  // The default context includes the set of valid
  // step ids that can be used in expressions
  const contextSteps = new Set<string>();
  for (const {key} of defaultContext.pairs()) {
    contextSteps.add(key);
  }

  // Copy the default context for each step
  // If the step is an action, add the action outputs to the context
  const stepsContext = new DescriptionDictionary();
  for (const step of workflowContext.job.steps) {
    if (!contextSteps.has(step.id)) {
      continue;
    }

    const defaultStepContext = defaultContext.get(step.id);
    if (!defaultStepContext) {
      stepsContext.add(step.id, new data.Null());
      continue;
    }

    if (!isActionStep(step) || !isDescriptionDictionary(defaultStepContext)) {
      stepsContext.add(step.id, defaultStepContext);
      continue;
    }

    const action = parseActionReference(step.uses.value);
    if (!action) {
      stepsContext.add(step.id, defaultStepContext);
      continue;
    }

    const stepContext = new DescriptionDictionary();
    for (const {key, value, description} of defaultStepContext.pairs()) {
      switch (key) {
        case "outputs": {
          const outputs = await getActionOutputs(octokit, cache, action);
          if (!outputs) {
            stepContext.add(key, value, description);
            continue;
          }
          const outputsDict = new DescriptionDictionary();
          // Actions can have dynamic outputs beyond what's declared in action.yml
          outputsDict.complete = false;
          for (const [key, value] of Object.entries(outputs)) {
            outputsDict.add(key, new data.StringData(value.description), value.description);
          }
          stepContext.add("outputs", outputsDict);
          break;
        }
        default:
          stepContext.add(key, value, description);
      }
    }
    stepsContext.add(step.id, stepContext);
  }

  return stepsContext;
}
