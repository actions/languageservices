import {documentLinks, hover, validate, ValidationConfig} from "@github/actions-languageservice";
import {registerLogger, setLogLevel} from "@github/actions-languageservice/log";
import {Octokit} from "@octokit/rest";
import {
  CompletionItem,
  Connection,
  DocumentLink,
  DocumentLinkParams,
  Hover,
  HoverParams,
  InitializeParams,
  InitializeResult,
  TextDocumentPositionParams,
  TextDocuments,
  TextDocumentSyncKind
} from "vscode-languageserver";
import {TextDocument} from "vscode-languageserver-textdocument";
import {contextProviders} from "./context-providers";
import {InitializationOptions, RepositoryContext} from "./initializationOptions";
import {onCompletion} from "./on-completion";
import {TTLCache} from "./utils/cache";
import {valueProviders} from "./value-providers";
import {getActionInputs} from "./value-providers/action-inputs";

export function initConnection(connection: Connection) {
  const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

  let sessionToken: string | undefined;
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
    sessionToken = options.sessionToken;
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

  // The content of a text document has changed. This event is emitted
  // when the text document first opened or when its content has changed.
  documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
  });

  async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    const repoContext = repos.find(repo => textDocument.uri.startsWith(repo.workspaceUri));

    const config: ValidationConfig = {
      valueProviderConfig: valueProviders(sessionToken, repoContext, cache),
      contextProviderConfig: contextProviders(sessionToken, repoContext, cache),
      getActionInputs: async action => {
        if (sessionToken) {
          const octokit = new Octokit({
            auth: sessionToken
          });
          return await getActionInputs(octokit, cache, action);
        }
        return undefined;
      }
    };
    const result = await validate(textDocument, config);

    connection.sendDiagnostics({uri: textDocument.uri, diagnostics: result});
  }

  connection.onCompletion(async ({position, textDocument}: TextDocumentPositionParams): Promise<CompletionItem[]> => {
    return await onCompletion(
      position,
      documents.get(textDocument.uri)!,
      sessionToken,
      repos.find(repo => textDocument.uri.startsWith(repo.workspaceUri)),
      cache
    );
  });

  connection.onHover(async ({position, textDocument}: HoverParams): Promise<Hover | null> => {
    return hover(documents.get(textDocument.uri)!, position);
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
