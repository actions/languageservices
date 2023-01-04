import {ActionReference, ActionInputs, ActionOutputs, actionIdentifier} from "@github/actions-languageservice/action";
import {Octokit, RestEndpointMethodTypes} from "@octokit/rest";
import {parse} from "yaml";
import {TTLCache} from "./cache";

export type ActionMetadata = {
  inputs?: ActionInputs;
  outputs?: ActionOutputs;
};

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

  return parseActionMetadata(metadata);
}

async function getActionMetadata(client: Octokit, action: ActionReference): Promise<string | undefined> {
  let resp: RestEndpointMethodTypes["repos"]["getContent"]["response"];
  try {
    resp = await client.repos.getContent({
      owner: action.owner,
      repo: action.name,
      ref: action.ref,
      path: action.path ? `${action.path}/action.yml` : "action.yml"
    });
  } catch (e: any) {
    // If action.yml doesn't exist, try action.yaml
    if (e.status === 404) {
      resp = await client.repos.getContent({
        owner: action.owner,
        repo: action.name,
        ref: action.ref,
        path: action.path ? `${action.path}/action.yaml` : "action.yaml"
      });
    } else {
      throw e;
    }
  }

  // https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28
  // Ignore directories (array of files) and non-file content
  if (resp.data === undefined || Array.isArray(resp.data) || resp.data.type !== "file") {
    return undefined;
  }

  if (resp.data.content === undefined) {
    return undefined;
  }

  const text = Buffer.from(resp.data.content, "base64").toString("utf8");
  // Remove any null bytes
  return text.replace(/\0/g, "");
}

// https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions
async function parseActionMetadata(content: string): Promise<ActionMetadata> {
  const metadata: ActionMetadata = parse(content);
  return metadata;
}
