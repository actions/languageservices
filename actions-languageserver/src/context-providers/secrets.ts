import {data, DescriptionDictionary} from "@github/actions-expressions";
import {StringData} from "@github/actions-expressions/data/string";
import {WorkflowContext} from "@github/actions-languageservice/context/workflow-context";
import {isMapping, isString} from "@github/actions-workflow-parser";
import {isJob} from "@github/actions-workflow-parser/model/type-guards";
import {Octokit} from "@octokit/rest";
import {RepositoryContext} from "../initializationOptions";
import {TTLCache} from "../utils/cache";

export async function getSecrets(
  workflowContext: WorkflowContext,
  octokit: Octokit,
  cache: TTLCache,
  repo: RepositoryContext,
  defaultContext: DescriptionDictionary | undefined
): Promise<DescriptionDictionary> {
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
      description: `Secret for environment \`${environmentName}\``
    })
  );

  const secretsContext = defaultContext || new DescriptionDictionary();

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
          fetchEnvironmentSecrets(octokit, repo.id, environmentName)
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
  }

  return [];
}

async function fetchEnvironmentSecrets(
  octokit: Octokit,
  repositoryId: number,
  environmentName: string
): Promise<StringData[]> {
  try {
    return await octokit.paginate(
      octokit.actions.listEnvironmentSecrets,
      {
        repository_id: repositoryId,
        environment_name: environmentName,
        per_page: 100
      },
      response => response.data.map(secret => new StringData(secret.name))
    );
  } catch (e) {
    console.log("Failure to retrieve environment secrets: ", e);
  }

  return [];
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
  }

  return [];
}
