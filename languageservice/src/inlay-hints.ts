import {isString} from "@actions/workflow-parser";
import {getCronDescription} from "@actions/workflow-parser/model/converter/cron";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";
import {File} from "@actions/workflow-parser/workflows/file";
import {TextDocument} from "vscode-languageserver-textdocument";
import {InlayHint, InlayHintKind} from "vscode-languageserver-types";
import {isActionDocument} from "./utils/document-type.js";
import {getOrParseWorkflow} from "./utils/workflow-cache.js";

/**
 * Returns inlay hints for a workflow document.
 * Currently supports cron expressions, showing a human-readable description
 * of the schedule inline after the cron value.
 *
 * @param document Text document to get inlay hints for
 * @returns Array of inlay hints
 */
export function getInlayHints(document: TextDocument): InlayHint[] {
  // Inlay hints are only supported for workflow files (cron expressions)
  if (isActionDocument(document.uri)) {
    return [];
  }

  const file: File = {
    name: document.uri,
    content: document.getText()
  };

  const result = getOrParseWorkflow(file, document.uri);
  if (!result?.value) {
    return [];
  }

  const hints: InlayHint[] = [];

  // Traverse the workflow AST to find cron expressions
  for (const [parent, token, key] of TemplateToken.traverse(result.value)) {
    const validationToken = key || parent || token;
    const validationDefinition = validationToken.definition;

    // Check for cron-pattern tokens
    if (isString(token) && token.range && validationDefinition?.key === "cron-pattern") {
      const cronValue = token.value;
      const description = getCronDescription(cronValue);

      if (description) {
        // Position the hint at the end of the cron value
        hints.push({
          position: {
            line: token.range.end.line - 1, // Convert from 1-based to 0-based
            character: token.range.end.column - 1 // Convert from 1-based to 0-based
          },
          label: `→ ${description}`,
          kind: InlayHintKind.Parameter,
          paddingLeft: true
        });
      }
    }
  }

  return hints;
}
