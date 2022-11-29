import { complete } from "@github/actions-languageservice/complete";
import { CompletionItem, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { contextProviders } from "./context-providers";
import { RepositoryContext } from "./initializationOptions";
import { TTLCache } from "./utils/cache";
import { valueProviders } from "./value-providers";

export async function onCompletion(
  position: Position,
  document: TextDocument,
  sessionToken: string | undefined,
  repoContext: RepositoryContext | undefined,
  cache: TTLCache
): Promise<CompletionItem[]> {
  return await complete(
    document,
    position,
    repoContext && valueProviders(sessionToken, repoContext, cache),
    repoContext && contextProviders(sessionToken, repoContext, cache)
  );
}
