import {CodeAction, TextEdit} from "vscode-languageserver-types";
import {CodeActionContext, CodeActionProvider} from "../types";
import {DiagnosticCode, MissingInputsDiagnosticData} from "../../validate-action";

export const addMissingInputsProvider: CodeActionProvider = {
  diagnosticCodes: [DiagnosticCode.MissingRequiredInputs],

  createCodeAction(context, diagnostic): CodeAction | undefined {
    const data = diagnostic.data as MissingInputsDiagnosticData | undefined;
    if (!data) {
      return undefined;
    }

    const edits = createInputEdits(data);
    if (!edits) {
      return undefined;
    }

    const inputNames = data.missingInputs.map(i => i.name).join(", ");

    return {
      title: `Add missing input${data.missingInputs.length > 1 ? "s" : ""}: ${inputNames}`,
      edit: {
        changes: {
          [context.uri]: edits
        }
      }
    };
  }
};

function createInputEdits(data: MissingInputsDiagnosticData): TextEdit[] | undefined {
  const edits: TextEdit[] = [];

  if (data.hasWithKey && data.withIndent !== undefined) {
    // `with:` exists - use its indentation + 2 for inputs
    const inputIndent = " ".repeat(data.withIndent + 2);

    const inputLines = data.missingInputs.map(input => {
      const value = input.default !== undefined ? input.default : '""';
      return `${inputIndent}${input.name}: ${value}`;
    });

    edits.push({
      range: {start: data.insertPosition, end: data.insertPosition},
      newText: inputLines.map(line => line + "\n").join("")
    });
  } else {
    // No `with:` key - use step indentation for `with:`, +2 for inputs
    const withIndent = " ".repeat(data.stepIndent + 2);
    const inputIndent = " ".repeat(data.stepIndent + 4);

    const inputLines = data.missingInputs.map(input => {
      const value = input.default !== undefined ? input.default : '""';
      return `${inputIndent}${input.name}: ${value}`;
    });

    const newText = [`${withIndent}with:\n`, ...inputLines.map(line => `${line}\n`)].join("");

    edits.push({
      range: {start: data.insertPosition, end: data.insertPosition},
      newText
    });
  }

  return edits;
}
