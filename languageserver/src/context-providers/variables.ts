import {data, DescriptionDictionary} from "@actions/expressions";
import {Pair} from "@actions/expressions/data/expressiondata";
import {StringData} from "@actions/expressions/data/index";
import {WorkflowContext} from "@actions/languageservice/context/workflow-context";
import {log, warn} from "@actions/languageservice/log";
import {isMapping, isString} from "@actions/workflow-parser";
import {Octokit} from "@octokit/rest";
import {RequestError} from "@octokit/request-error";

import {RepositoryContext} from "../initializationOptions";
import {TTLCache} from "../utils/cache";
import {errorStatus} from "../utils/error";
import {getRepoPermission} from "../utils/repo-permission";

export async function getVariables(
  workflowContext: WorkflowContext,
  octokit: Octokit,
  cache: TTLCache,
  repo: RepositoryContext,
  defaultContext: DescriptionDictionary | undefined
): Promise<DescriptionDictionary | undefined> {
  const permission = await getRepoPermission(octokit, cache, repo);
  if (permission === "none") {
    const secretsContext = defaultContext || new DescriptionDictionary();
    secretsContext.complete = false;
    return secretsContext;
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
          }
          break;
        }
      }
    }
  }

  const variablesContext = defaultContext || new DescriptionDictionary();
  try {
    const variables = await getRemoteVariables(octokit, cache, repo, environmentName);

    // Build combined map of variables
    const variablesMap = new Map<
      string,
      {
        key: string;
        value: data.StringData;
        description?: string;
      }
    >();

    variables.organizationVariables.forEach(variable =>
      variablesMap.set(variable.key.toLowerCase(), {
        key: variable.key,
        value: new data.StringData(variable.value.coerceString()),
        description: `${variable.value.coerceString()} - Organization variable`
      })
    );

    // Override org variables with repo variables
    variables.repoVariables.forEach(variable =>
      variablesMap.set(variable.key.toLowerCase(), {
        key: variable.key,
        value: new data.StringData(variable.value.coerceString()),
        description: `${variable.value.coerceString()} - Repository variable`
      })
    );

    // Override repo variables with environment veriables (if defined)
    variables.environmentVariables.forEach(variable =>
      variablesMap.set(variable.key.toLowerCase(), {
        key: variable.key,
        value: new data.StringData(variable.value.coerceString()),
        description: `${variable.value.coerceString()} - Variable for environment \`${environmentName || ""}\``
      })
    );

    // Sort variables by key and add to context
    Array.from(variablesMap.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .forEach(variable => variablesContext?.add(variable.key, variable.value, variable.description));

    return variablesContext;
  } catch (e) {
    if (!(e instanceof RequestError)) throw e;
    if (e.name == "HttpError" && e.status == 404) {
      log("Failure to request variables. Ignore if you're using GitHub Enterprise Server below version 3.8");
      return variablesContext;
    } else throw e;
  }
}

export async function getRemoteVariables(
  octokit: Octokit,
  cache: TTLCache,
  repo: RepositoryContext,
  environmentName?: string
): Promise<{
  repoVariables: Pair[];
  environmentVariables: Pair[];
  organizationVariables: Pair[];
}> {
  // Repo variables
  return {
    repoVariables: await cache.get(`${repo.owner}/${repo.name}/vars`, undefined, () =>
      fetchVariables(octokit, repo.owner, repo.name)
    ),
    environmentVariables:
      (environmentName &&
        (await cache.get(`${repo.owner}/${repo.name}/vars/environment/${environmentName}`, undefined, () =>
          fetchEnvironmentVariables(octokit, repo.owner, repo.name, environmentName)
        ))) ||
      [],
    organizationVariables: await cache.get(`${repo.owner}/vars`, undefined, () =>
      fetchOrganizationVariables(octokit, repo)
    )
  };
}

async function fetchVariables(octokit: Octokit, owner: string, name: string): Promise<Pair[]> {
  try {
    return await octokit.paginate(
      octokit.actions.listRepoVariables,
      {
        owner: owner,
        repo: name,
        per_page: 100
      },
      response =>
        response.data.map(variable => {
          return {key: variable.name, value: new StringData(variable.value)};
        })
    );
  } catch (e) {
    console.log("Failure to retrieve variables: ", e);
    throw e;
  }
}

async function fetchEnvironmentVariables(
  octokit: Octokit,
  owner: string,
  name: string,
  environmentName: string
): Promise<Pair[]> {
  try {
    return await octokit.paginate(
      octokit.actions.listEnvironmentVariables,
      {
        owner: owner,
        repo: name,
        environment_name: environmentName,
        per_page: 100
      },
      response =>
        response.data.map(variable => {
          return {key: variable.name, value: new StringData(variable.value)};
        })
    );
  } catch (e) {
    if (errorStatus(e) === 404) {
      warn(`Environment ${environmentName} not found`);
      return [];
    }
    console.log("Failure to retrieve environment variables: ", e);
    throw e;
  }
}

async function fetchOrganizationVariables(octokit: Octokit, repo: RepositoryContext): Promise<Pair[]> {
  if (!repo.organizationOwned) {
    return [];
  }

  try {
    const variables: {name: string; value: string}[] = await octokit.paginate(
      "GET /repos/{owner}/{repo}/actions/organization-variables",
      {
        owner: repo.owner,
        repo: repo.name,
        per_page: 100
      }
    );
    return variables.map(variable => {
      return {key: variable.name, value: new StringData(variable.value)};
    });
  } catch (e) {
    console.log("Failure to retrieve organization variables: ", e);
    throw e;
  }
}
