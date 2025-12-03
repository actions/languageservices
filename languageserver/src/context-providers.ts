import {DescriptionDictionary} from "@actions/expressions";
import {ContextProviderConfig} from "@actions/languageservice";
import {Mode} from "@actions/languageservice/context-providers/default";
import {WorkflowContext} from "@actions/languageservice/context/workflow-context";
import {Octokit} from "@octokit/rest";
import {getSecrets} from "./context-providers/secrets";
import {getStepsContext} from "./context-providers/steps";
import {getVariables} from "./context-providers/variables";
import {RepositoryContext, SecretsValidationMode} from "./initializationOptions";
import {TTLCache} from "./utils/cache";

export function contextProviders(
  client: Octokit | undefined,
  repo: RepositoryContext | undefined,
  cache: TTLCache,
  secretsValidation: SecretsValidationMode = "auto"
): ContextProviderConfig {
  // Handle missing client/repo based on validation mode
  if (!repo || !client) {
    // "never" - always suppress validation
    // "auto" - suppress when context is incomplete (client or repo missing)
    // "always" - show warnings even when context is incomplete
    const shouldSuppress = secretsValidation === "never" || secretsValidation === "auto";

    if (shouldSuppress) {
      // Mark secrets/vars as incomplete to prevent false warnings
      return {
        getContext: (
          name: string,
          defaultContext: DescriptionDictionary | undefined,
          workflowContext: WorkflowContext,
          mode: Mode
        ) => {
          if (name === "secrets" || name === "vars") {
            const dict = defaultContext || new DescriptionDictionary();
            dict.complete = false;
            return Promise.resolve(dict);
          }
          return Promise.resolve(undefined);
        }
      };
    }
    // "always" mode - return undefined to trigger warnings
    return {getContext: () => Promise.resolve(undefined)};
  }

  const getContext = async (
    name: string,
    defaultContext: DescriptionDictionary | undefined,
    workflowContext: WorkflowContext,
    mode: Mode
  ) => {
    // If validation is disabled, mark as incomplete
    if (secretsValidation === "never" && (name === "secrets" || name === "vars")) {
      const dict = defaultContext || new DescriptionDictionary();
      dict.complete = false;
      return dict;
    }

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
