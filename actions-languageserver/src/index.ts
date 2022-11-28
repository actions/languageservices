import {
  CompletionItem,
  createConnection,
  Hover,
  HoverParams,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
  TextDocumentPositionParams,
  TextDocuments,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";

import { hover, validate } from "@github/actions-languageservice";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  InitializationOptions,
  RepositoryContext,
} from "./initializationOptions";
import { onCompletion } from "./on-completion";
import { TTLCache } from "./utils/cache";
import { valueProviders } from "./value-providers";

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let sessionToken: string | undefined;
let repos: RepositoryContext[] = [];
const cache = new TTLCache();

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  const options: InitializationOptions = params.initializationOptions;
  sessionToken = options.sessionToken;
  if (options.repos) {
    repos = options.repos;
  }

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: [":", "."],
      },
      hoverProvider: true,
    },
  };

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }

  return result;
});

connection.onInitialized(() => {
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log("Workspace folder change event received.");
    });
  }
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const result = await validate(
    textDocument,
    valueProviders(sessionToken, repoWorkspaceMap)
  );

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: result });
}

connection.onDidChangeWatchedFiles((_change) => {
  // Monitored files have change in VSCode
  connection.console.log("We received an file change event");
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  async ({
    position,
    textDocument,
  }: TextDocumentPositionParams): Promise<CompletionItem[]> => {
    return await onCompletion(
      position,
      documents.get(textDocument.uri)!,
      sessionToken,
      repos.find((repo) => textDocument.uri.startsWith(repo.workspaceUri)),
      cache
    );
  }
);

connection.onHover(
  async ({ position, textDocument }: HoverParams): Promise<Hover | null> => {
    const r = await hover(documents.get(textDocument.uri)!, position);
    return r;
  }
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
