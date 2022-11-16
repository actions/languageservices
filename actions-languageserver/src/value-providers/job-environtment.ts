import { Value } from "@github/actions-languageservice/value-providers/config";
import { Octokit } from "@octokit/rest";

export async function getEnvironments(
  client: Octokit,
  owner: string,
  name: string
): Promise<Value[]> {
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
    console.log(e);
  }

  return Array.from(environments).map((e) => ({ label: e }));
}
