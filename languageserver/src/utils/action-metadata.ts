import {actionIdentifier, ActionMetadata, ActionReference} from "@actions/languageservice/action";
import {ActionsMetadataProvider} from "@actions/languageservice";
import {error} from "@actions/languageservice/log";
import {Octokit, RestEndpointMethodTypes} from "@octokit/rest";
import {parse} from "yaml";
import {TTLCache} from "./cache";
import {errorMessage, errorStatus} from "./error";

export function getActionsMetadataProvider(
  client: Octokit | undefined,
  cache: TTLCache
): ActionsMetadataProvider | undefined {
  if (!client) {
    return undefined;
  }

  return {
    fetchActionMetadata: async action => fetchActionMetadata(client, cache, action)
  };
}

export async function fetchActionMetadata(
  client: Octokit,
  cache: TTLCache,
  action: ActionReference
): Promise<ActionMetadata | undefined> {
  const metadata = await cache.get(`${actionIdentifier(action)}/action-metadata`, undefined, () =>
    getActionMetadata(client, action)
  );
  if (!metadata) {
    return undefined;
  }

  // https://docs.github.com/actions/creating-actions/metadata-syntax-for-github-actions
  return parse(metadata) as ActionMetadata;
}

async function getActionMetadata(client: Octokit, action: ActionReference): Promise<string | undefined> {
  let resp: RestEndpointMethodTypes["repos"]["getContent"]["response"];
  try {
    resp = await fetchAction(client, action);
  } catch (e) {
    error(`Failed to fetch action metadata for ${actionIdentifier(action)}: '${errorMessage(e)}'`);
    return;
  }

  // https://docs.github.com/rest/repos/contents?apiVersion=2022-11-28
  // Ignore directories (array of files) and non-file content
  if (resp.data === undefined || Array.isArray(resp.data) || resp.data.type !== "file") {
    return undefined;
  }

  if (resp.data.content === undefined) {
    return undefined;
  }

  return Buffer.from(resp.data.content, "base64").toString("utf8");
}

async function fetchAction(client: Octokit, action: ActionReference) {
  try {
    return await client.repos.getContent({
      owner: action.owner,
      repo: action.name,
      ref: action.ref,
      path: action.path ? `${action.path}/action.yml` : "action.yml"
    });
  } catch (e) {
    // If action.yml doesn't exist, try action.yaml
    if (errorStatus(e) === 404) {
      return await client.repos.getContent({
        owner: action.owner,
        repo: action.name,
        ref: action.ref,
        path: action.path ? `${action.path}/action.yaml` : "action.yaml"
      });
    } else {
      throw e;
    }
  }
}
