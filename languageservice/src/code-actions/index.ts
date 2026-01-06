import {FeatureFlags} from "@actions/expressions";
import {CodeAction, CodeActionKind, Diagnostic} from "vscode-languageserver-types";
import {CodeActionContext, CodeActionProvider} from "./types.js";
import {getQuickfixProviders} from "./quickfix/index.js";

export interface CodeActionParams {
  uri: string;
  diagnostics: Diagnostic[];
  only?: string[];
  featureFlags?: FeatureFlags;
}

export function getCodeActions(params: CodeActionParams): CodeAction[] {
  const actions: CodeAction[] = [];
  const context: CodeActionContext = {
    uri: params.uri,
    featureFlags: params.featureFlags
  };

  // Build providers map based on feature flags
  const providersByKind: Map<string, CodeActionProvider[]> = new Map([
    [CodeActionKind.QuickFix, getQuickfixProviders(params.featureFlags)]
    // [CodeActionKind.Refactor, getRefactorProviders(params.featureFlags)],
    // [CodeActionKind.Source, getSourceProviders(params.featureFlags)],
    // etc
  ]);

  // Filter to requested kinds, or use all if none specified
  const requestedKinds = params.only;
  const kindsToCheck = requestedKinds
    ? [...providersByKind.keys()].filter(kind => requestedKinds.some(requested => kind.startsWith(requested)))
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

export type {CodeActionContext, CodeActionProvider} from "./types.js";
