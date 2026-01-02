/**
 * Document type detection for workflow and action files.
 * Detection is based on file path/name only - content heuristics are not used
 * because files in non-standard locations wouldn't work as workflows/actions anyway.
 */

export type DocumentType = "workflow" | "action" | "unknown";

/**
 * Detects whether a document is a workflow file, action file, or unknown based on its URI.
 *
 * @param uri The document URI or file path
 * @returns The detected document type
 */
export function detectDocumentType(uri: string): DocumentType {
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
