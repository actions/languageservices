import {DescriptionDictionary} from "@actions/expressions";
import {ContextProviderConfig} from "@actions/languageservice";
import {Mode} from "@actions/languageservice/context-providers/default";
import {WorkflowContext} from "@actions/languageservice/context/workflow-context";
import {Octokit} from "@octokit/rest";
import {getSecrets} from "./context-providers/secrets";
import {getStepsContext} from "./context-providers/steps";
import {getVariables} from "./context-providers/variables";
import {RepositoryContext} from "./initializationOptions";
import {TTLCache} from "./utils/cache";

export function contextProviders(
  client: Octokit | undefined,
  repo: RepositoryContext | undefined,
  cache: TTLCache
): ContextProviderConfig {
  if (!repo || !client) {
    return {getContext: () => Promise.resolve(undefined)};
  }

  const getContext = async (
    name: string,
    defaultContext: DescriptionDictionary | undefined,
    workflowContext: WorkflowContext,
    mode: Mode
  ) => {
    switch (name) {
      case "secrets":
        return await getSecrets(workflowContext, client, cache, repo, defaultContext, mode);
      case "vars":
        return await getVariables(workflowContext, client, cache, repo, defaultContext);
      case "steps":
        return await getStepsContext(client, cache, defaultContext, workflowContext);
    }
  };

  return {getContext};
}
