import { CodeAction, Diagnostic } from "vscode-languageserver-types";

export interface CodeActionContext {
  uri: string;
  // TODO: add things like workflow template, parsed content, etc.
}

/**
 * A provider that can produce a code action for a given diagnostic
 */
export interface CodeActionProvider {
  /**
   * The diagnostic codes this provider handles
   */
  diagnosticCodes: (string | number | undefined)[];

  /**
   * Create a code action for the diagnostic, if applicable
   */
  createCodeAction(context: CodeActionContext, diagnostic: Diagnostic): CodeAction | undefined;
}
