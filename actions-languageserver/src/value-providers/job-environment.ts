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
      repo: "bob",
    });

    if (response.data.environments) {
      environments = response.data.environments.map((env) => env.name);
    }
  } catch (e) {
    console.log("Failure to retrieve environments: ", e);
  }

  return Array.from(environments).map((env) => ({ label: env }));
}
