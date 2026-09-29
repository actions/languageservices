import {ActionInputs, ActionReference, parseActionReference} from "@actions/languageservice/action";
import {WorkflowContext} from "@actions/languageservice/context/workflow-context";
import {Value} from "@actions/languageservice/value-providers/config";
import {isActionStep} from "@actions/workflow-parser/model/type-guards";
import {Octokit} from "@octokit/rest";
import {fetchActionMetadata} from "../utils/action-metadata.js";
import {TTLCache} from "../utils/cache.js";

export async function getActionInputs(
  client: Octokit,
  cache: TTLCache,
  action: ActionReference
): Promise<ActionInputs | undefined> {
  return (await fetchActionMetadata(client, cache, action))?.inputs;
}

export async function getActionInputValues(
  client: Octokit,
  cache: TTLCache,
  context: WorkflowContext
): Promise<Value[]> {
  if (!context.step || !isActionStep(context.step)) {
    return [];
  }

  const action = parseActionReference(context.step.uses.value);
  if (!action) {
    return [];
  }
  const inputs = await getActionInputs(client, cache, action);
  if (!inputs) {
    return [];
  }

  return Object.entries(inputs).map(([inputName, input]) => {
    return {
      label: inputName,
      description: input.description,
      insertText: `${inputName}: `,
      deprecated: input.deprecationMessage !== undefined
    };
  });
}
