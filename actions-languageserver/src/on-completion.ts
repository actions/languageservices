import { complete } from "@github/actions-languageservice/complete";
import { WorkflowContext } from "@github/actions-languageservice/context/workflow-context";
import { Value, ValueProviderConfig } from "@github/actions-languageservice/value-providers/config";
import { Octokit } from "@octokit/rest";
import { CompletionItem, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { RepositoryContext } from "./initializationOptions";
import { TTLCache } from "./utils/cache";
import { getEnvironments } from "./value-providers/job-environment";
import { getRunnerLabels } from "./value-providers/runs-on";

export async function onCompletion(
  position: Position,
  document: TextDocument,
  sessionToken: string | undefined,
  repoContext: RepositoryContext | undefined,
  cache: TTLCache,
): Promise<CompletionItem[]> {
  const config: ValueProviderConfig = {
    getCustomValues: async (key: string, context: WorkflowContext) =>
      getCustomValues(key, context, sessionToken, repoContext, cache),
  };
  return await complete(document, position, config);
}


async function getCustomValues(
  key: string,
  _: WorkflowContext,
  sessionToken: string | undefined,
  repo: RepositoryContext | undefined,
  cache: TTLCache,
): Promise<Value[] | undefined> {
  if (!sessionToken || !repo) {
    return;
  }

  const octokit = new Octokit({
    auth: sessionToken,
  });

  switch (key) {
    case "job-environment": {
      return await getEnvironments(octokit, cache, repo.owner, repo.name);
    }

    case "runs-on": {
      return await getRunnerLabels(octokit, cache, repo.owner, repo.name);
    }
  }
}
