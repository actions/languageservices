import {convertWorkflowTemplate, parseWorkflow, ParseWorkflowResult} from "@github/actions-workflow-parser";
import {TokenRange} from "@github/actions-workflow-parser/templates/tokens/token-range";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {TextDocument} from "vscode-languageserver-textdocument";
import {Diagnostic, Range} from "vscode-languageserver-types";
import {nullTrace} from "./nulltrace";

/**
 * Validates a workflow file
 *
 * @param textDocument Document to validate
 * @returns Array of diagnostics
 */
export async function validate(
  textDocument: TextDocument
  // TODO: Support multiple files, context for API calls
): Promise<Diagnostic[]> {
  const file: File = {
    name: textDocument.uri,
    content: textDocument.getText()
  };

  try {
    const result: ParseWorkflowResult = parseWorkflow(file.name, [file], nullTrace);

    if (result.value) {
      // Errors will be updated in the context
      convertWorkflowTemplate(result.context, result.value);
    }

    // For now map parser errors directly to diagnostics
    return result.context.errors.getErrors().map(error => {
      let range = mapRange(error.range);
      if (!range) {
        // Use default range
        range = {
          start: {
            line: 1,
            character: 1
          },
          end: {
            line: 1,
            character: 1
          }
        };
      }

      return {
        message: error.rawMessage,
        range
      };
    });
  } catch (e) {
    // TODO: Handle error here
    return [];
  }
}

function mapRange(range: TokenRange | undefined): Range | undefined {
  if (!range) {
    return undefined;
  }

  return {
    start: {
      line: range.start[0] - 1,
      character: range.start[1] - 1
    },
    end: {
      line: range.end[0] - 1,
      character: range.end[1] - 1
    }
  };
}
