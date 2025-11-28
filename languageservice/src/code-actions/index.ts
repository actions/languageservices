import { CodeAction, CodeActionKind, Diagnostic } from "vscode-languageserver-types";
import { CodeActionContext, CodeActionProvider } from "./types";
import { quickfixProviders } from "./quickfix";

// Aggregate all providers by kind
const providersByKind: Map<string, CodeActionProvider[]> = new Map([
  [CodeActionKind.QuickFix, quickfixProviders],
  // [CodeActionKind. Refactor, refactorProviders],
  // [CodeActionKind.Source, sourceProviders],
  // etc
]);

export interface CodeActionConfig {
  // TODO: actionsMetadataProvider, fileProvider, etc.
}

export interface CodeActionParams {
  uri: string;
  diagnostics: Diagnostic[];
  only?: string[];
}

export function getCodeActions(params: CodeActionParams, config?: CodeActionConfig): CodeAction[] {
  const actions: CodeAction[] = [];
  const context: CodeActionContext = {
    uri: params.uri,
  };

  // Filter to requested kinds, or use all if none specified
  const requestedKinds = params.only;
  const kindsToCheck = requestedKinds
    ? [...providersByKind.keys()].filter(kind =>
      requestedKinds.some(requested => kind.startsWith(requested)))
    : [...providersByKind.keys()];

  for (const diagnostic of params.diagnostics) {
    for (const kind of kindsToCheck) {
      const providers = providersByKind.get(kind) ?? [];
      for (const provider of providers) {
        if (provider.diagnosticCodes.includes(diagnostic.code)) {
          const action = provider.createCodeAction(context, diagnostic);
          if (action) {
            action.kind = kind;
            action.diagnostics = [diagnostic];
            actions.push(action);
          }
        }
      }
    }
  }

  return actions;
}

export type { CodeActionContext, CodeActionProvider } from "./types";
