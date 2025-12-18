import {CodeAction, TextEdit} from "vscode-languageserver-types";
import {CodeActionProvider} from "../types.js";
import {DiagnosticCode, MissingInputsDiagnosticData} from "../../validate-action-reference.js";

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

function createInputEdits(data: MissingInputsDiagnosticData): TextEdit[] {
  const edits: TextEdit[] = [];

  const formatInputLines = (indent: string) =>
    data.missingInputs.map(input => {
      const value = input.default ?? '""';
      return `${indent}${input.name}: ${value}`;
    });

  if (data.hasWithKey && data.withIndent !== undefined) {
    // `with:` exists - use its indentation + 2 for inputs
    const inputIndent = " ".repeat(data.withIndent + data.indentSize);
    const inputLines = formatInputLines(inputIndent);

    edits.push({
      range: {start: data.insertPosition, end: data.insertPosition},
      newText: inputLines.map(line => line + "\n").join("")
    });
  } else {
    // No `with:` key - `with:` at step indentation, inputs at step indentation + 2
    const withIndent = " ".repeat(data.stepIndent);
    const inputIndent = " ".repeat(data.stepIndent + data.indentSize);
    const inputLines = formatInputLines(inputIndent);

    const newText = [`${withIndent}with:\n`, ...inputLines.map(line => `${line}\n`)].join("");

    edits.push({
      range: {start: data.insertPosition, end: data.insertPosition},
      newText
    });
  }

  return edits;
}
