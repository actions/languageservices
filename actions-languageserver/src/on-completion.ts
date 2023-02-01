import {complete} from "@github/actions-languageservice/complete";
import {Octokit} from "@octokit/rest";
import {CompletionItem, Position} from "vscode-languageserver";
import {TextDocument} from "vscode-languageserver-textdocument";
import {contextProviders} from "./context-providers";
import {RepositoryContext} from "./initializationOptions";
import {TTLCache} from "./utils/cache";
import {valueProviders} from "./value-providers";

export async function onCompletion(
  position: Position,
  document: TextDocument,
  client: Octokit | undefined,
  repoContext: RepositoryContext | undefined,
  cache: TTLCache
): Promise<CompletionItem[]> {
  return await complete(
    document,
    position,
    repoContext && valueProviders(client, repoContext, cache),
    repoContext && contextProviders(client, repoContext, cache)
  );
}
