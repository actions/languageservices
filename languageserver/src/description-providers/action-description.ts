import {parseActionReference} from "@github/actions-languageservice/action";
import {isActionStep} from "@github/actions-workflow-parser/model/type-guards";
import {Step} from "@github/actions-workflow-parser/model/workflow-template";
import {Octokit} from "@octokit/rest";
import {fetchActionMetadata} from "../utils/action-metadata";
import {TTLCache} from "../utils/cache";

export async function getActionDescription(client: Octokit, cache: TTLCache, step: Step): Promise<string | undefined> {
  if (!isActionStep(step)) {
    return undefined;
  }
  const action = parseActionReference(step.uses.value);
  if (!action) {
    return undefined;
  }

  const metadata = await fetchActionMetadata(client, cache, action);
  if (!metadata?.name || !metadata?.description) {
    return undefined;
  }

  return `**${metadata.name}**\n\n${metadata.description}`;
}
