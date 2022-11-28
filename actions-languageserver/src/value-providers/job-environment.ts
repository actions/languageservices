import { Value } from "@github/actions-languageservice/value-providers/config";
import { Octokit } from "@octokit/rest";
import { TTLCache } from "../utils/cache";

export async function getEnvironments(
  client: Octokit,
  cache: TTLCache,
  owner: string,
  name: string
): Promise<Value[]> {
  const environments = await cache.get(`${owner}/${name}/environments`, undefined, () => fetchEnvironments(client, owner, name));
  return Array.from(environments).map((env) => ({ label: env }));
}

async function fetchEnvironments(
  client: Octokit,
  owner: string,
  name: string
): Promise<string[]> {
  let environments: string[] = [];
  try {
    const response = await client.repos.getAllEnvironments({
      owner,
      repo: name,
    });

    if (response.data.environments) {
      environments = response.data.environments.map((env) => env.name);
    }
  } catch (e) {
    console.log("Failure to retrieve environments: ", e);
  }

  return environments;
}
