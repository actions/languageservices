import { Value } from "@github/actions-languageservice/value-providers/config";
import { Octokit } from "@octokit/rest";
import { TTLCache } from "../utils/cache";

export async function getRunnerLabels(
  client: Octokit,
  cache: TTLCache,
  owner: string,
  name: string
): Promise<Value[]> {
  const defaultLabels = [
    "ubuntu-22.04",
    "ubuntu-latest",
    "ubuntu-20.04",
    "ubuntu-18.04",
    "windows-latest",
    "windows-2022",
    "windows-2019",
    "windows-2016",
    "macos-latest",
    "macos-12",
    "macos-11",
    "macos-10.15",
    "self-hosted",
  ];

  const repoLabels = await cache.get(`${owner}/${name}/runner-labels`, undefined, () => fetchRunnerLabels(client, owner, name));
  for (const label of defaultLabels) {
    repoLabels.add(label);
  }
  return Array.from(repoLabels).map((label) => ({ label }));
}

async function fetchRunnerLabels(
  client: Octokit,
  owner: string,
  name: string
): Promise<Set<string>> {
  const labels = new Set<string>();
  try {
    const response = await client.actions.listSelfHostedRunnersForRepo({
      owner,
      repo: name,
    });

    for (const runner of response.data.runners) {
      for (const label of runner.labels) {
        labels.add(label.name);
      }
    }
  } catch (e) {
    console.log("Failure to retrieve runner labels: ", e);
  }

  return labels;
}
