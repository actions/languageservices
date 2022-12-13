import {
  actionIdentifier,
  ActionInputs,
  ActionReference,
  parseActionReference
} from "@github/actions-languageservice/action";
import {WorkflowContext} from "@github/actions-languageservice/context/workflow-context";
import {Value} from "@github/actions-languageservice/value-providers/config";
import {isActionStep} from "@github/actions-workflow-parser/model/type-guards";
import {Octokit, RestEndpointMethodTypes} from "@octokit/rest";
import {parse} from "yaml";
import {TTLCache} from "../utils/cache";

export async function getActionInputs(
  client: Octokit,
  cache: TTLCache,
  action: ActionReference
): Promise<ActionInputs | undefined> {
  const inputs = await cache.get(`${actionIdentifier(action)}/action-inputs`, undefined, () =>
    fetchActionInputs(client, action)
  );

  return inputs;
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
      description: input.description
    };
  });
}

async function fetchActionInputs(client: Octokit, action: ActionReference): Promise<ActionInputs | undefined> {
  const metadata = await getActionMetadata(client, action);
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

type ActionMetadata = {
  inputs?: ActionInputs;
};

// https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions#inputs
type ActionInput = {
  description: string;
  required?: boolean;
  default?: string;
  deprecationMessage?: string;
};

// https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions
async function parseActionMetadata(content: string): Promise<ActionInputs> {
  const metadata: ActionMetadata = parse(content);
  return metadata.inputs ?? {};
}
