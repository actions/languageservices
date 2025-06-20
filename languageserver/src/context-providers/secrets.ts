import {data, DescriptionDictionary} from "@actions/expressions";
import {StringData} from "@actions/expressions/data/string";
import {Mode} from "@actions/languageservice/context-providers/default";
import {WorkflowContext} from "@actions/languageservice/context/workflow-context";
import {warn} from "@actions/languageservice/log";
import {isMapping, isString} from "@actions/workflow-parser";
import {Octokit} from "@octokit/rest";

import {RepositoryContext} from "../initializationOptions";
import {TTLCache} from "../utils/cache";
import {errorStatus} from "../utils/error";
import {getRepoPermission} from "../utils/repo-permission";

export async function getSecrets(
  workflowContext: WorkflowContext,
  octokit: Octokit,
  cache: TTLCache,
  repo: RepositoryContext,
  defaultContext: DescriptionDictionary | undefined,
  mode: Mode
): Promise<DescriptionDictionary> {
  const secretsContext = defaultContext || new DescriptionDictionary();

  const permission = await getRepoPermission(octokit, cache, repo);
  if (permission === "none") {
    secretsContext.complete = false;
    return secretsContext;
  }

  const eventsConfig = workflowContext?.template?.events;

  if (eventsConfig?.workflow_call) {
    // Unpredictable secrets may be passed in via a workflow_call trigger
    secretsContext.complete = false;
    // Exit early for validation mode or if workflow_call is the only trigger
    if (mode === Mode.Validation || Object.keys(eventsConfig).length == 1) {
      return secretsContext;
    }
  }

  let environmentName: string | undefined;

  if (workflowContext?.job?.environment) {
    if (isString(workflowContext.job.environment)) {
      environmentName = workflowContext.job.environment.value;
    } else if (isMapping(workflowContext.job.environment)) {
      for (const x of workflowContext.job.environment) {
        if (isString(x.key) && x.key.value === "name") {
          if (isString(x.value)) {
            environmentName = x.value.value;
          } else {
            // this means we have a dynamic environment, in those situations we
            // want to make sure we skip doing secret validation
            secretsContext.complete = false;
          }
          break;
        }
      }
    } else {
      // if the expression is something like environment: ${{ ... }} then we want to skip validation
      secretsContext.complete = false;
    }
  }

  const secrets = await getRemoteSecrets(octokit, cache, repo, environmentName);

  // Build combined map of secrets
  const secretsMap = new Map<
    string,
    {
      key: string;
      value: data.StringData;
      description?: string;
    }
  >();

  secrets.orgSecrets.forEach(secret =>
    secretsMap.set(secret.value.toLowerCase(), {
      key: secret.value,
      value: new data.StringData("***"),
      description: "Organization secret"
    })
  );

  // Override org secrets with repo secrets
  secrets.repoSecrets.forEach(secret =>
    secretsMap.set(secret.value.toLowerCase(), {
      key: secret.value,
      value: new data.StringData("***"),
      description: "Repository secret"
    })
  );

  // Override repo secrets with environment secrets (if defined)
  secrets.environmentSecrets.forEach(secret =>
    secretsMap.set(secret.value.toLowerCase(), {
      key: secret.value,
      value: new data.StringData("***"),
      description: `Secret for environment \`${environmentName || ""}\``
    })
  );

  // Sort secrets by key and add to context
  Array.from(secretsMap.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .forEach(secret => secretsContext?.add(secret.key, secret.value, secret.description));

  return secretsContext;
}

async function getRemoteSecrets(
  octokit: Octokit,
  cache: TTLCache,
  repo: RepositoryContext,
  environmentName?: string
): Promise<{
  repoSecrets: StringData[];
  environmentSecrets: StringData[];
  orgSecrets: StringData[];
}> {
  return {
    repoSecrets: await cache.get(`${repo.owner}/${repo.name}/secrets`, undefined, () =>
      fetchSecrets(octokit, repo.owner, repo.name)
    ),
    environmentSecrets:
      (environmentName &&
        (await cache.get(`${repo.owner}/${repo.name}/secrets/environment/${environmentName}`, undefined, () =>
          fetchEnvironmentSecrets(octokit, repo.owner, repo.name, environmentName)
        ))) ||
      [],
    orgSecrets: await cache.get(`${repo.owner}/secrets`, undefined, () => fetchOrganizationSecrets(octokit, repo))
  };
}

async function fetchSecrets(octokit: Octokit, owner: string, name: string): Promise<StringData[]> {
  try {
    return await octokit.paginate(
      octokit.actions.listRepoSecrets,
      {
        owner,
        repo: name,
        per_page: 100
      },
      response => response.data.map(secret => new StringData(secret.name))
    );
  } catch (e) {
    console.log("Failure to retrieve secrets: ", e);
    throw e;
  }
}

async function fetchEnvironmentSecrets(
  octokit: Octokit,
  owner: string,
  name: string,
  environmentName: string
): Promise<StringData[]> {
  try {
    return await octokit.paginate(
      octokit.actions.listEnvironmentSecrets,
      {
        owner,
        repo: name,
        environment_name: environmentName,
        per_page: 100
      },
      response => response.data.map(secret => new StringData(secret.name))
    );
  } catch (e) {
    if (errorStatus(e) === 404) {
      warn(`Environment ${environmentName} not found`);
      return [];
    }
    console.log("Failure to retrieve environment secrets: ", e);
    throw e;
  }
}

async function fetchOrganizationSecrets(octokit: Octokit, repo: RepositoryContext): Promise<StringData[]> {
  if (!repo.organizationOwned) {
    return [];
  }

  try {
    const secrets: {name: string}[] = await octokit.paginate("GET /repos/{owner}/{repo}/actions/organization-secrets", {
      owner: repo.owner,
      repo: repo.name,
      per_page: 100
    });
    return secrets.map(secret => new StringData(secret.name));
  } catch (e) {
    console.log("Failure to retrieve organization secrets: ", e);
    throw e;
  }
}
