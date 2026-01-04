import {ActionOutputs, ActionReference} from "@actions/languageservice/action";
import {Octokit} from "@octokit/rest";
import {fetchActionMetadata} from "../utils/action-metadata.js";
import {TTLCache} from "../utils/cache.js";

export async function getActionOutputs(
  octokit: Octokit,
  cache: TTLCache,
  action: ActionReference
): Promise<ActionOutputs | undefined> {
  return (await fetchActionMetadata(octokit, cache, action))?.outputs;
}
