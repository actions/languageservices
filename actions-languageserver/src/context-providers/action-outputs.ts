import {ActionReference, ActionOutputs} from "@github/actions-languageservice/action";
import {Octokit} from "@octokit/rest";
import {fetchActionMetadata} from "../utils/action-metadata";
import {TTLCache} from "../utils/cache";

export async function getActionOutputs(
  octokit: Octokit,
  cache: TTLCache,
  action: ActionReference
): Promise<ActionOutputs | undefined> {
  return (await fetchActionMetadata(octokit, cache, action))?.outputs;
}
