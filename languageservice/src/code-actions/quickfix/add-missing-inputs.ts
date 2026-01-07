import {CodeAction, Position, TextEdit} from "vscode-languageserver-types";
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
    if (!edits || edits.length === 0) {
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

/**
 * Calculate insert position and indentation, then generate edits for missing inputs.
 * Position calculation is done here in the quickfix rather than during validation.
 */
function createInputEdits(data: MissingInputsDiagnosticData): TextEdit[] {
  const formatInputLines = (indent: string) =>
    data.missingInputs.map(input => {
      const value = input.default ?? '""';
      return `${indent}${input.name}: ${value}`;
    });

  if (data.withInfo) {
    // `with:` exists - calculate indentation from existing structure
    const withIndent = data.withInfo.keyRange.start.column - 1; // 0-indexed
    const indentSize = data.withInfo.firstChildColumn
      ? data.withInfo.firstChildColumn - data.withInfo.keyRange.start.column
      : data.indentSize;

    const inputIndent = " ".repeat(withIndent + indentSize);
    const inputLines = formatInputLines(inputIndent);

    // Calculate insert position
    const insertPosition = calculateWithInsertPosition(data.withInfo);

    return [
      {
        range: {start: insertPosition, end: insertPosition},
        newText: inputLines.map(line => line + "\n").join("")
      }
    ];
  } else {
    // No `with:` key - add `with:` at the same level as other step keys (e.g., "uses")
    const firstKeyColumn = data.firstStepKeyColumn ?? data.stepRange.start.column;
    const withKeyIndent = firstKeyColumn - 1; // 0-indexed (columns are 1-based)

    const withIndent = " ".repeat(withKeyIndent);
    const inputIndent = " ".repeat(withKeyIndent + data.indentSize);
    const inputLines = formatInputLines(inputIndent);

    const newText = `${withIndent}with:\n` + inputLines.map(line => `${line}\n`).join("");

    // Insert at end of step (before the line after the step ends)
    const insertPosition: Position = {
      line: data.stepRange.end.line - 1,
      character: 0
    };

    return [
      {
        range: {start: insertPosition, end: insertPosition},
        newText
      }
    ];
  }
}

/**
 * Calculate where to insert new inputs when `with:` already exists.
 */
function calculateWithInsertPosition(withInfo: NonNullable<MissingInputsDiagnosticData["withInfo"]>): Position {
  if (withInfo.hasChildren) {
    // Insert after the last child (at end of with: block)
    return {
      line: withInfo.valueRange.end.line - 1,
      character: 0
    };
  } else {
    // Empty with: block - insert on the next line after with:
    return {
      line: withInfo.keyRange.end.line,
      character: 0
    };
  }
}
