import {documentLinks, hover, validate, ValidationConfig} from "@github/actions-languageservice";
import {registerLogger, setLogLevel} from "@github/actions-languageservice/log";
import {Octokit} from "@octokit/rest";
import {
  CompletionItem,
  Connection,
  DocumentLink,
  DocumentLinkParams,
  ExecuteCommandParams,
  Hover,
  HoverParams,
  InitializeParams,
  InitializeResult,
  TextDocumentPositionParams,
  TextDocuments,
  TextDocumentSyncKind
} from "vscode-languageserver";
import {TextDocument} from "vscode-languageserver-textdocument";
import {getClient} from "./client";
import {Commands} from "./commands";
import {contextProviders} from "./context-providers";
import {descriptionProvider} from "./description-provider";
import {getFileProvider} from "./file-provider";
import {InitializationOptions, RepositoryContext} from "./initializationOptions";
import {onCompletion} from "./on-completion";
import {ReadFileRequest, Requests} from "./request";
import {fetchActionMetadata} from "./utils/action-metadata";
import {TTLCache} from "./utils/cache";
import {timeOperation} from "./utils/timer";
import {valueProviders} from "./value-providers";
import {clearCacheEntry, clearCache} from "@github/actions-languageservice/utils/workflow-cache";

export function initConnection(connection: Connection) {
  const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

  let client: Octokit | undefined;
  let repos: RepositoryContext[] = [];
  const cache = new TTLCache();

  let hasWorkspaceFolderCapability = false;
  let hasDiagnosticRelatedInformationCapability = false;

  // Register remote console logger with language service
  registerLogger(connection.console);

  connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    hasDiagnosticRelatedInformationCapability = !!(
      capabilities.textDocument &&
      capabilities.textDocument.publishDiagnostics &&
      capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    const options: InitializationOptions = params.initializationOptions;

    if (options.sessionToken) {
      client = getClient(options.sessionToken, options.userAgent);
    }

    if (options.repos) {
      repos = options.repos;
    }

    if (options.logLevel !== undefined) {
      setLogLevel(options.logLevel);
    }

    const result: InitializeResult = {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full,
        completionProvider: {
          resolveProvider: false,
          triggerCharacters: [":", "."]
        },
        hoverProvider: true,
        documentLinkProvider: {
          resolveProvider: false
        }
      }
    };

    if (hasWorkspaceFolderCapability) {
      result.capabilities.workspace = {
        workspaceFolders: {
          supported: true
        }
      };
    }

    return result;
  });

  connection.onInitialized(() => {
    if (hasWorkspaceFolderCapability) {
      connection.workspace.onDidChangeWorkspaceFolders(_event => {
        clearCache();
      });
    }
  });

  // The content of a text document has changed. This event is emitted
  // when the text document first opened or when its content has changed.
  documents.onDidChangeContent(change => {
    clearCacheEntry(change.document.uri);
    return timeOperation("validation", async () => await validateTextDocument(change.document));
  });

  async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    const repoContext = repos.find(repo => textDocument.uri.startsWith(repo.workspaceUri));

    const config: ValidationConfig = {
      valueProviderConfig: valueProviders(client, repoContext, cache),
      contextProviderConfig: contextProviders(client, repoContext, cache),
      fetchActionMetadata: async action => {
        if (client) {
          return await fetchActionMetadata(client, cache, action);
        }

        return undefined;
      },
      fileProvider: getFileProvider(client, cache, repoContext?.workspaceUri, async path => {
        return await connection.sendRequest(Requests.ReadFile, {path} satisfies ReadFileRequest);
      })
    };

    const result = await validate(textDocument, config);
    await connection.sendDiagnostics({uri: textDocument.uri, diagnostics: result});
  }

  connection.onCompletion(async ({position, textDocument}: TextDocumentPositionParams): Promise<CompletionItem[]> => {
    return timeOperation(
      "completion",
      async () =>
        await onCompletion(
          connection,
          position,
          documents.get(textDocument.uri)!,
          client,
          repos.find(repo => textDocument.uri.startsWith(repo.workspaceUri)),
          cache
        )
    );
  });

  connection.onHover(async ({position, textDocument}: HoverParams): Promise<Hover | null> => {
    return timeOperation("hover", async () => {
      const repoContext = repos.find(repo => textDocument.uri.startsWith(repo.workspaceUri));
      return await hover(documents.get(textDocument.uri)!, position, {
        descriptionProvider: descriptionProvider(client, cache),
        contextProviderConfig: repoContext && contextProviders(client, repoContext, cache),
        fileProvider: getFileProvider(client, cache, repoContext?.workspaceUri, async path => {
          return await connection.sendRequest(Requests.ReadFile, {path});
        })
      });
    });
  });

  connection.onRequest("workspace/executeCommand", (params: ExecuteCommandParams) => {
    if (params.command === Commands.ClearCache) {
      cache.clear();
      documents.all().forEach(validateTextDocument);
    }
  });

  connection.onDocumentLinks(async ({textDocument}: DocumentLinkParams): Promise<DocumentLink[] | null> => {
    return documentLinks(documents.get(textDocument.uri)!);
  });

  // Make the text document manager listen on the connection
  // for open, change and close text document events
  documents.listen(connection);

  // Listen on the connection
  connection.listen();
}
