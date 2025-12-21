import {complete} from "@actions/languageservice/complete";
import {Octokit} from "@octokit/rest";
import {CompletionItem, Connection, Position} from "vscode-languageserver";
import {TextDocument} from "vscode-languageserver-textdocument";
import {contextProviders} from "./context-providers.js";
import {getFileProvider} from "./file-provider.js";
import {RepositoryContext} from "./initializationOptions.js";
import {Requests} from "./request.js";
import {TTLCache} from "./utils/cache.js";
import {valueProviders} from "./value-providers.js";

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
      return await connection.sendRequest(Requests.ReadFile, {path});
    })
  });
}
