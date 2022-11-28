import { complete } from "@github/actions-languageservice/complete";
import { WorkflowContext } from "@github/actions-languageservice/context/workflow-context";
import { ValueProviderConfig } from "@github/actions-languageservice/value-providers/config";
import { Octokit } from "@octokit/rest";
import { CompletionItem, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { RepositoryContext } from "./initializationOptions";
import { getEnvironments } from "./value-providers/job-environment";
import { getRunnerLabels } from "./value-providers/runs-on";

export async function onCompletion(
  position: Position,
  document: TextDocument,
  sessionToken: string | undefined,
  repoContext: RepositoryContext | undefined
): Promise<CompletionItem[]> {
  const config: ValueProviderConfig = {
    getCustomValues: async (key: string, context: WorkflowContext) =>
      getCustomValues(key, context, sessionToken, repoContext),
  };
  return await complete(document, position, config);
}

async function getCustomValues(
  key: string,
  context: WorkflowContext,
  sessionToken: string | undefined,
  repo: RepositoryContext | undefined,
) {
  if (!sessionToken || !repo) {
    return;
  }

  const octokit = new Octokit({
    auth: sessionToken,
  });

  switch (key) {
    case "job-environment": {
      return await getEnvironments(octokit, repo.owner, repo.name);
    }

    case "runs-on": {
      return await getRunnerLabels(octokit, repo.owner, repo.name);
    }
  }
}
