import {ValueProviderConfig} from "@github/actions-languageservice";
import {WorkflowContext} from "@github/actions-languageservice/context/workflow-context";
import {ValueProviderKind} from "@github/actions-languageservice/value-providers/config";
import {Octokit} from "@octokit/rest";
import {RepositoryContext} from "./initializationOptions";
import {TTLCache} from "./utils/cache";
import {getActionInputs} from "./value-providers/action-inputs";
import {getEnvironments} from "./value-providers/job-environment";
import {getRunnerLabels} from "./value-providers/runs-on";

export function valueProviders(
  sessionToken: string | undefined,
  repo: RepositoryContext | undefined,
  cache: TTLCache
): ValueProviderConfig {
  if (!repo || !sessionToken) {
    return {};
  }

  const octokit = new Octokit({
    auth: sessionToken
  });

  return {
    "job-environment": {
      kind: ValueProviderKind.AllowedValues,
      get: (_: WorkflowContext) => getEnvironments(octokit, cache, repo.owner, repo.name)
    },
    "job-environment-name": {
      kind: ValueProviderKind.AllowedValues,
      get: (_: WorkflowContext) => getEnvironments(octokit, cache, repo.owner, repo.name)
    },
    "runs-on": {
      kind: ValueProviderKind.SuggestedValues,
      get: (_: WorkflowContext) => getRunnerLabels(octokit, cache, repo.owner, repo.name)
    },
    "step-with": {
      kind: ValueProviderKind.AllowedValues,
      get: (context: WorkflowContext) => getActionInputs(octokit, cache, context)
    }
  };
}
