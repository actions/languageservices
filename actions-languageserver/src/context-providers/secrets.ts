import {StringData} from "@github/actions-expressions/data/string";
import {Octokit} from "@octokit/rest";
import {RepositoryContext} from "../initializationOptions";
import {TTLCache} from "../utils/cache";

export async function getSecrets(
  octokit: Octokit,
  cache: TTLCache,
  repo: RepositoryContext,
  environmentName?: string
): Promise<{
  repoSecrets: StringData[];
  environmentSecrets: StringData[];
}> {
  return {
    repoSecrets: await await cache.get(`${repo.owner}/${repo.name}/secrets`, undefined, () =>
      fetchSecrets(octokit, repo.owner, repo.name)
    ),
    environmentSecrets:
      (environmentName &&
        (await cache.get(`${repo.owner}/${repo.name}/secrets/environment/${environmentName}`, undefined, () =>
          fetchEnvironmentSecrets(octokit, repo.id, environmentName)
        ))) ||
      []
  };
}

async function fetchSecrets(octokit: Octokit, owner: string, name: string): Promise<StringData[]> {
  try {
    const response = await octokit.actions.listRepoSecrets({
      owner,
      repo: name
    });

    return response.data.secrets.map(secret => new StringData(secret.name));
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
    const response = await octokit.actions.listEnvironmentSecrets({
      repository_id: repositoryId,
      environment_name: environmentName
    });

    return response.data.secrets.map(secret => new StringData(secret.name));
  } catch (e) {
    console.log("Failure to retrieve environment secrets: ", e);
  }

  return [];
}
