import {documentLinks, getCodeActions, getInlayHints, hover, validate, ValidationConfig} from "@actions/languageservice";
import {registerLogger, setLogLevel} from "@actions/languageservice/log";
import {clearCache, clearCacheEntry} from "@actions/languageservice/utils/workflow-cache";
import {Octokit} from "@octokit/rest";
import {
  CodeAction,
  CodeActionKind,
  CodeActionParams,
  CompletionItem,
  Connection,
  DocumentLink,
  DocumentLinkParams,
  ExecuteCommandParams,
  Hover,
  HoverParams,
  InitializeParams,
  InitializeResult,
  InlayHint,
  InlayHintParams,
  TextDocumentIdentifier,
  TextDocumentPositionParams,
  TextDocuments,
  TextDocumentSyncKind
} from "vscode-languageserver";
import {TextDocument} from "vscode-languageserver-textdocument";
import {getClient} from "./client.js";
import {Commands} from "./commands.js";
import {contextProviders} from "./context-providers.js";
import {descriptionProvider} from "./description-provider.js";
import {getFileProvider} from "./file-provider.js";
import {InitializationOptions, RepositoryContext} from "./initializationOptions.js";
import {onCompletion} from "./on-completion.js";
import {ReadFileRequest, Requests} from "./request.js";
import {getActionsMetadataProvider} from "./utils/action-metadata.js";
import {TTLCache} from "./utils/cache.js";
import {timeOperation} from "./utils/timer.js";
import {valueProviders} from "./value-providers.js";

export function initConnection(connection: Connection) {
  const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

  let client: Octokit | undefined;
  let repos: RepositoryContext[] = [];
  const cache = new TTLCache();

  let hasWorkspaceFolderCapability = false;

  // Register remote console logger with language service
  registerLogger(connection.console);

  connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);

    const options = params.initializationOptions as InitializationOptions;

    if (options.sessionToken) {
      client = getClient(options.sessionToken, options.userAgent, options.gitHubApiUrl);
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
        },
        inlayHintProvider: true,
        codeActionProvider: {
          codeActionKinds: [CodeActionKind.QuickFix]
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
      connection.workspace.onDidChangeWorkspaceFolders(() => {
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
      actionsMetadataProvider: getActionsMetadataProvider(client, cache),
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
          getDocument(documents, textDocument),
          client,
          repos.find(repo => textDocument.uri.startsWith(repo.workspaceUri)),
          cache
        )
    );
  });

  connection.onHover(async ({position, textDocument}: HoverParams): Promise<Hover | null> => {
    return timeOperation("hover", async () => {
      const repoContext = repos.find(repo => textDocument.uri.startsWith(repo.workspaceUri));
      return await hover(getDocument(documents, textDocument), position, {
        descriptionProvider: descriptionProvider(client, cache),
        contextProviderConfig: repoContext && contextProviders(client, repoContext, cache),
        fileProvider: getFileProvider(client, cache, repoContext?.workspaceUri, async path => {
          return await connection.sendRequest(Requests.ReadFile, {path});
        })
      });
    });
  });

  connection.onRequest("workspace/executeCommand", async (params: ExecuteCommandParams) => {
    if (params.command === Commands.ClearCache) {
      cache.clear();
      await Promise.all(documents.all().map(doc => validateTextDocument(doc)));
    }
  });

  connection.onDocumentLinks(async ({textDocument}: DocumentLinkParams): Promise<DocumentLink[] | null> => {
    const repoContext = repos.find(repo => textDocument.uri.startsWith(repo.workspaceUri));
    return documentLinks(getDocument(documents, textDocument), repoContext?.workspaceUri);
  });

  connection.languages.inlayHint.on(async ({textDocument}: InlayHintParams): Promise<InlayHint[] | null> => {
    return timeOperation("inlayHints", () => {
      return getInlayHints(getDocument(documents, textDocument));
    });
  });

  connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
    return getCodeActions({
      uri: params.textDocument.uri,
      diagnostics: params.context.diagnostics,
      only: params.context.only
    });
  });

  // Make the text document manager listen on the connection
  // for open, change and close text document events
  documents.listen(connection);

  // Listen on the connection
  connection.listen();
}

function getDocument(documents: TextDocuments<TextDocument>, id: TextDocumentIdentifier): TextDocument {
  // The text document manager should ensure all documents exist
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return documents.get(id.uri)!;
}
