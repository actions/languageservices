import {log} from "@actions/languageservice/log";
import {Value} from "@actions/languageservice/value-providers/config";
import {DEFAULT_RUNNER_LABELS} from "@actions/languageservice/value-providers/default";
import {Octokit} from "@octokit/rest";
import {TTLCache} from "../utils/cache";
import {errorMessage} from "../utils/error";

// Limitation: getRunnerLabels returns default hosted labels and labels for repository self-hosted runners.
// It doesn't return labels for organization runners visible to the repository.
export async function getRunnerLabels(client: Octokit, cache: TTLCache, owner: string, name: string): Promise<Value[]> {
  const repoLabels = await cache.get(`${owner}/${name}/runner-labels`, undefined, () =>
    fetchRunnerLabels(client, owner, name)
  );

  for (const label of DEFAULT_RUNNER_LABELS) {
    repoLabels.add(label);
  }

  return Array.from(repoLabels).map(label => ({label}));
}

async function fetchRunnerLabels(client: Octokit, owner: string, name: string): Promise<Set<string>> {
  const labels = new Set<string>();
  try {
    const itor = client.paginate.iterator(client.actions.listSelfHostedRunnersForRepo, {
      owner,
      repo: name,
      per_page: 100
    });

    for await (const response of itor) {
      for (const runner of response.data) {
        for (const label of runner.labels) {
          labels.add(label.name);
        }
      }
    }
  } catch (e) {
    log(`Failure to retrieve runner labels: ${errorMessage(e)}`);
  }

  return labels;
}
