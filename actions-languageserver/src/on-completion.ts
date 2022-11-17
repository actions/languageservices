import { complete } from "@github/actions-languageservice/complete";
import {
  ValueProviderConfig,
  WorkflowContext,
} from "@github/actions-languageservice/value-providers/config";
import { Octokit } from "@octokit/rest";
import { CompletionItem, DocumentUri, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { RepositoryContext } from "./initializationOptions";
import { getEnvironments } from "./value-providers/job-environment";
import { getRunnerLabels } from "./value-providers/runs-on";

export async function onCompletion(
  position: Position,
  uri: DocumentUri,
  document: TextDocument,
  sessionToken: string | undefined,
  repoWorkflowMap: Map<string, RepositoryContext>
): Promise<CompletionItem[]> {
  const config: ValueProviderConfig = {
    getCustomValues: async (key: string, context: WorkflowContext) =>
      getCustomValues(key, context, sessionToken, repoWorkflowMap),
  };
  return await complete(document, position, config);
}

async function getCustomValues(
  key: string,
  context: WorkflowContext,
  sessionToken: string | undefined,
  repoWorkspaceMap: Map<string, RepositoryContext>
) {
  if (!sessionToken) {
    return;
  }

  // TODO: Parse workflow URI and look up repo for workspace
  const [repo] = repoWorkspaceMap.values();
  if (!repo) {
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
