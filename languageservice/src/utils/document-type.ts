/**
 * Document type detection for workflow and action files.
 * Detection is based on file path/name only - content heuristics are not used
 * because files in non-standard locations wouldn't work as workflows/actions anyway.
 */

import {URI} from "vscode-uri";

export type DocumentType = "workflow" | "action" | "unknown";

/**
 * Detects whether a document is a workflow file, action file, or unknown based on its URI.
 *
 * @param uri The document URI or file path
 * @returns The detected document type
 */
export function detectDocumentType(uri: string): DocumentType {
  // VS Code uses a "git" scheme for documents in a diff view.
  // Those URIs can have a query string, which means the regex we
  // use won't always match because we anchor to the end of the
  // URI. Extract the path from those URIs and use that instead.
  const parsed = URI.parse(uri);
  if (parsed.scheme === "git") {
    uri = parsed.path;
  }

  // Normalize path separators
  const normalizedUri = uri.replace(/\\/g, "/");

  // Check for workflow file patterns FIRST (more specific path takes precedence)
  // Matches: .github/workflows/*.yml or .github/workflows/*.yaml
  // Also matches: .github/workflows-lab/*.yml or .github/workflows-lab/*.yaml
  // This ensures .github/workflows/action.yml is treated as a workflow, not an action
  if (/\.github\/workflows(-lab)?\/[^/]+\.ya?ml$/i.test(normalizedUri)) {
    return "workflow";
  }

  // Check for action.yml/action.yaml patterns
  // Matches: action.yml, action.yaml, .github/actions/my-action/action.yml, etc.
  if (/\/action\.ya?ml$/i.test(normalizedUri) || /^action\.ya?ml$/i.test(normalizedUri)) {
    return "action";
  }

  return "unknown";
}

/**
 * Check if a document is an action file
 */
export function isActionDocument(uri: string): boolean {
  return detectDocumentType(uri) === "action";
}

/**
 * Check if a document is a workflow file
 */
export function isWorkflowDocument(uri: string): boolean {
  return detectDocumentType(uri) === "workflow";
}
