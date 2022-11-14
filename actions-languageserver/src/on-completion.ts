import { complete } from "@github/actions-languageservice/complete";
import {
  ValueProviderConfig,
  WorkflowContext,
} from "@github/actions-languageservice/value-providers/config";
import { Octokit } from "@octokit/rest";
import { CompletionItem, DocumentUri, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { RepositoryContext } from "./initializationOptions";
import { getJobNames } from "./value-providers/needs";
import { getRunnerLabels } from "./value-providers/runs-on";
import { WorkflowTemplate } from "@github/actions-workflow-parser";


export async function onCompletion(
  position: Position,
  uri: DocumentUri,
  document: TextDocument,
  sessionToken: string | undefined,
  repoWorkflowMap: Map<string, RepositoryContext>
): Promise<CompletionItem[]> {
  const config: ValueProviderConfig = {
    getCustomValues: async (key: string, context: WorkflowContext, template: WorkflowTemplate | undefined) =>
      getCustomValues(key, context, sessionToken, repoWorkflowMap, template),
  };
  return await complete(document, position, config);
}

async function getCustomValues(
  key: string,
  context: WorkflowContext,
  sessionToken: string | undefined,
  repoWorkspaceMap: Map<string, RepositoryContext>,
  template: WorkflowTemplate | undefined
) {
  if (!sessionToken) {
    return;
  }

  // TODO: Parse workflow URI and look up repo for workspace
  const [repo] = repoWorkspaceMap.values();
  if (!repo) {
    return;
  }
  if (key === "runs-on") {
    const octokit = new Octokit({
      auth: sessionToken,
    });
    return await getRunnerLabels(octokit, repo.owner, repo.name);
  }
   if (key === "needs" && template) {
     return await getJobNames(template);
   }
}
