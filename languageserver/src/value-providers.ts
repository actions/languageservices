import {ValueProviderConfig} from "@actions/languageservice";
import {WorkflowContext} from "@actions/languageservice/context/workflow-context";
import {ValueProviderKind} from "@actions/languageservice/value-providers/config";
import {Octokit} from "@octokit/rest";
import {RepositoryContext} from "./initializationOptions.js";
import {TTLCache} from "./utils/cache.js";
import {getActionInputValues} from "./value-providers/action-inputs.js";
import {getEnvironments} from "./value-providers/job-environment.js";
import {getRunnerLabels} from "./value-providers/runs-on.js";

export function valueProviders(
  client: Octokit | undefined,
  repo: RepositoryContext | undefined,
  cache: TTLCache
): ValueProviderConfig {
  if (!repo || !client) {
    return {};
  }

  return {
    "job-environment": {
      kind: ValueProviderKind.AllowedValues,
      caseInsensitive: true,
      get: () => getEnvironments(client, cache, repo.owner, repo.name)
    },
    "job-environment-name": {
      kind: ValueProviderKind.AllowedValues,
      caseInsensitive: true,
      get: () => getEnvironments(client, cache, repo.owner, repo.name)
    },
    "runs-on": {
      kind: ValueProviderKind.SuggestedValues,
      get: () => getRunnerLabels(client, cache, repo.owner, repo.name)
    },
    "step-with": {
      kind: ValueProviderKind.AllowedValues,
      get: (context: WorkflowContext) => getActionInputValues(client, cache, context)
    }
  };
}
