import {StringData} from "@github/actions-expressions/data/string";
import {Octokit} from "@octokit/rest";
import {TTLCache} from "../utils/cache";

export function getSecrets(octokit: Octokit, cache: TTLCache, owner: string, name: string): Promise<StringData[]> {
  return cache.get(`${owner}/${name}/secrets`, undefined, () => fetchSecrets(octokit, owner, name));
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
