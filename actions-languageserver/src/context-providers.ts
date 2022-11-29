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

  const getContext = async (name: string) => {
    switch (name) {
      case "secrets":
        const secrets = await getSecrets(octokit, cache, repo.owner, repo.name);
        const secretContext = new data.Dictionary();
        secrets.forEach(secret => secretContext.add(secret.value, secret));
        return secretContext;
    }
  };

  return {getContext};
}
