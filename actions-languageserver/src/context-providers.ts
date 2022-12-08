import {data} from "@github/actions-expressions";
import {ContextProviderConfig} from "@github/actions-languageservice/.";
import {Octokit} from "@octokit/rest";
import {getSecrets} from "./context-providers/secrets";
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

  const getContext = async (name: string, defaultContext: data.Dictionary | undefined) => {
    switch (name) {
      case "secrets":
        const secrets = await getSecrets(octokit, cache, repo.owner, repo.name);

        defaultContext = defaultContext || new data.Dictionary();
        secrets.forEach(secret => defaultContext!.add(secret.value, new data.StringData("***")));
        return defaultContext;
    }
  };

  return {getContext};
}
