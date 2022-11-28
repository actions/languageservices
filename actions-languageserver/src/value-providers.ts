import { ValueProviderConfig } from "@github/actions-languageservice";
import { WorkflowContext } from "@github/actions-languageservice/context/workflow-context";
import { Value } from "@github/actions-languageservice/value-providers/config";
import { Octokit } from "@octokit/rest";
import { RepositoryContext } from "./initializationOptions";
import { TTLCache } from "./utils/cache";
import { getEnvironments } from "./value-providers/job-environment";
import { getRunnerLabels } from "./value-providers/runs-on";

export function valueProviders(
  sessionToken: string | undefined,
  repoContext: RepositoryContext,
  cache: TTLCache
): ValueProviderConfig {
  return {
    "job-environment": passOctoKit(
      sessionToken,
      repoContext,
      cache,
      getEnvironments
    ),
    "runs-on": passOctoKit(sessionToken, repoContext, cache, getRunnerLabels),
  };
}

function passOctoKit(
  sessionToken: string | undefined,
  repo: RepositoryContext,
  cache: TTLCache,
  f: (
    octokit: Octokit,
    cache: TTLCache,
    owner: string,
    name: string
  ) => Promise<Value[]>
) {
  return async function (context: WorkflowContext): Promise<Value[]> {
    if (!sessionToken) {
      return [];
    }

    const octokit = new Octokit({
      auth: sessionToken,
    });

    return f(octokit, cache, repo.owner, repo.name);
  };
}
