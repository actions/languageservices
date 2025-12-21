import {parseActionReference} from "@actions/languageservice/action";
import {isString} from "@actions/workflow-parser";
import {isActionStep} from "@actions/workflow-parser/model/type-guards";
import {Step} from "@actions/workflow-parser/model/workflow-template";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";
import {Octokit} from "@octokit/rest";
import {fetchActionMetadata} from "../utils/action-metadata.js";
import {TTLCache} from "../utils/cache.js";

export async function getActionInputDescription(
  client: Octokit,
  cache: TTLCache,
  step: Step,
  token: TemplateToken
): Promise<string | undefined> {
  if (!isActionStep(step)) {
    return undefined;
  }
  const action = parseActionReference(step.uses.value);
  if (!action) {
    return undefined;
  }

  const inputName = isString(token) && token.value;
  if (!inputName) {
    return undefined;
  }

  const metadata = await fetchActionMetadata(client, cache, action);
  if (!metadata?.inputs) {
    return undefined;
  }

  const input = metadata.inputs[inputName];
  if (!input) {
    return undefined;
  }

  let description = input.description;

  const deprecated = input.deprecationMessage !== undefined;

  if (deprecated) {
    // Validation will include the deprecation message, so don't duplicate it here
    description += `\n\n**Deprecated**`;
  }

  if (input.required) {
    description += "\n\n**Required**";
  }

  return description;
}
