import {data} from "@github/actions-expressions";
import {isDictionary} from "@github/actions-expressions/data/dictionary";
import {parseActionReference} from "@github/actions-languageservice/action";
import {WorkflowContext} from "@github/actions-languageservice/context/workflow-context";
import {isActionStep} from "@github/actions-workflow-parser/model/type-guards";
import {Octokit} from "@octokit/rest";
import {TTLCache} from "../utils/cache";
import {getActionOutputs} from "./action-outputs";

export async function getStepsContext(
  octokit: Octokit,
  cache: TTLCache,
  defaultContext: data.Dictionary | undefined,
  workflowContext: WorkflowContext
): Promise<data.Dictionary | undefined> {
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
  const stepsContext = new data.Dictionary();
  for (const step of workflowContext.job.steps) {
    if (!contextSteps.has(step.id)) {
      continue;
    }

    const defaultStepContext = defaultContext.get(step.id);
    if (!defaultStepContext) {
      stepsContext.add(step.id, new data.Null());
      continue;
    }

    if (!isActionStep(step) || !isDictionary(defaultStepContext)) {
      stepsContext.add(step.id, defaultStepContext);
      continue;
    }

    const action = parseActionReference(step.uses.value);
    if (!action) {
      stepsContext.add(step.id, defaultStepContext);
      continue;
    }

    const stepContext = new data.Dictionary();
    for (const {key, value} of defaultStepContext.pairs()) {
      switch (key) {
        case "outputs":
          const outputs = await getActionOutputs(octokit, cache, action);
          if (!outputs) {
            stepContext.add(key, value);
            continue;
          }
          const outputsDict = new data.Dictionary();
          for (const [key, value] of Object.entries(outputs)) {
            outputsDict.add(key, new data.StringData(value.description));
          }
          stepContext.add("outputs", outputsDict);
          break;
        default:
          stepContext.add(key, value);
      }
    }
    stepsContext.add(step.id, stepContext);
  }

  return stepsContext;
}
