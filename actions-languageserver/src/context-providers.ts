import {data, DescriptionDictionary} from "@github/actions-expressions";
import {ContextProviderConfig} from "@github/actions-languageservice";
import {WorkflowContext} from "@github/actions-languageservice/context/workflow-context";
import {isMapping, isString} from "@github/actions-workflow-parser";
import {Octokit} from "@octokit/rest";
import {getSecrets} from "./context-providers/secrets";
import {getStepsContext} from "./context-providers/steps";
import {RepositoryContext} from "./initializationOptions";
import {TTLCache} from "./utils/cache";

export function contextProviders(
  sessionToken: string | undefined,
  repo: RepositoryContext | undefined,
  cache: TTLCache
): ContextProviderConfig {
  if (!repo || !sessionToken) {
    return {getContext: (_: string) => Promise.resolve(undefined)};
  }

  const octokit = new Octokit({
    auth: sessionToken
  });

  const getContext = async (
    name: string,
    defaultContext: DescriptionDictionary | undefined,
    workflowContext: WorkflowContext
  ) => {
    switch (name) {
      case "secrets": {
        let environmentName: string | undefined;
        if (workflowContext?.job?.environment) {
          if (isString(workflowContext.job.environment)) {
            environmentName = workflowContext.job.environment.value;
          } else if (isMapping(workflowContext.job.environment)) {
            for (const x of workflowContext.job.environment) {
              if (isString(x.key) && x.key.value === "name") {
                if (isString(x.value)) {
                  environmentName = x.value.value;
                }
                break;
              }
            }
          }
        }

        const secrets = await getSecrets(octokit, cache, repo, environmentName);

        defaultContext = defaultContext || new DescriptionDictionary();
        secrets.repoSecrets.forEach(secret =>
          defaultContext!.add(secret.value, new data.StringData("***"), "Repository secret")
        );
        secrets.environmentSecrets.forEach(secret =>
          defaultContext!.add(secret.value, new data.StringData("***"), `Secret for environment \`${environmentName}\``)
        );
        return defaultContext;
      }
      case "steps": {
        return await getStepsContext(octokit, cache, defaultContext, workflowContext);
      }
    }
  };

  return {getContext};
}
