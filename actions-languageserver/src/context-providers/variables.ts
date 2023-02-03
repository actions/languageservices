import {data, DescriptionDictionary} from "@github/actions-expressions";
import {WorkflowContext} from "@github/actions-languageservice/context/workflow-context";
import {isMapping, isString} from "@github/actions-workflow-parser";
import {Octokit} from "@octokit/rest";
import {Pair} from "@github/actions-expressions/data/expressiondata";
import {RepositoryContext} from "../initializationOptions";
import {StringData} from "@github/actions-expressions/data/index";
import {TTLCache} from "../utils/cache";
import {isJob} from "@github/actions-workflow-parser/model/type-guards";

export async function getVariables(
  workflowContext: WorkflowContext,
  octokit: Octokit,
  cache: TTLCache,
  repo: RepositoryContext,
  defaultContext: DescriptionDictionary | undefined
): Promise<DescriptionDictionary | undefined> {
  let environmentName: string | undefined;
  const job = workflowContext?.job;
  const environment = job && isJob(job) && job.environment;
  if (environment) {
    if (isString(environment)) {
      environmentName = environment.value;
    } else if (isMapping(environment)) {
      for (const x of environment) {
        if (isString(x.key) && x.key.value === "name") {
          if (isString(x.value)) {
            environmentName = x.value.value;
          }
          break;
        }
      }
    }
  }

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
      description: `${variable.value.coerceString()} - Variable for environment \`${environmentName}\``
    })
  );

  const variablesContext = defaultContext || new DescriptionDictionary();

  // Sort variables by key and add to context
  Array.from(variablesMap.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .forEach(variable => variablesContext?.add(variable.key, variable.value, variable.description));

  return variablesContext;
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
          fetchEnvironmentVariables(octokit, repo.id, environmentName)
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
  }

  return [];
}

async function fetchEnvironmentVariables(
  octokit: Octokit,
  repositoryId: number,
  environmentName: string
): Promise<Pair[]> {
  try {
    return await octokit.paginate(
      octokit.actions.listEnvironmentVariables,
      {
        repository_id: repositoryId,
        environment_name: environmentName,
        per_page: 100
      },
      response =>
        response.data.map(variable => {
          return {key: variable.name, value: new StringData(variable.value)};
        })
    );
  } catch (e) {
    console.log("Failure to retrieve environment variables: ", e);
  }

  return [];
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
  }

  return [];
}
