import {complete} from "@github/actions-languageservice/complete";
import {Octokit} from "@octokit/rest";
import {CompletionItem, Connection, Position} from "vscode-languageserver";
import {TextDocument} from "vscode-languageserver-textdocument";
import {contextProviders} from "./context-providers";
import {getFileProvider} from "./file-provider";
import {RepositoryContext} from "./initializationOptions";
import {TTLCache} from "./utils/cache";
import {valueProviders} from "./value-providers";

export async function onCompletion(
  connection: Connection,
  position: Position,
  document: TextDocument,
  client: Octokit | undefined,
  repoContext: RepositoryContext | undefined,
  cache: TTLCache
): Promise<CompletionItem[]> {
  return await complete(document, position, {
    valueProviderConfig: repoContext && valueProviders(client, repoContext, cache),
    contextProviderConfig: repoContext && contextProviders(client, repoContext, cache),
    fileProvider: getFileProvider(client, cache, repoContext?.workspaceUri, async path => {
      return await connection.sendRequest("actions/readFile", {path});
    })
  });
}
