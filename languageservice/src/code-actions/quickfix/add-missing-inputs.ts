import {isMapping} from "@actions/workflow-parser";
import {MappingToken} from "@actions/workflow-parser/templates/tokens/mapping-token";
import {ScalarToken} from "@actions/workflow-parser/templates/tokens/scalar-token";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";
import {CodeAction, Position, TextEdit} from "vscode-languageserver-types";
import {error} from "../../log.js";
import {findToken} from "../../utils/find-token.js";
import {getOrParseWorkflow} from "../../utils/workflow-cache.js";
import {DiagnosticCode, MissingInputsDiagnosticData} from "../../validate-action-reference.js";
import {CodeActionContext, CodeActionProvider} from "../types.js";

/**
 * Information extracted from a step token needed to generate edits
 */
interface StepInfo {
  /** Column where step keys start (1-indexed), e.g., the column of "uses:" */
  stepKeyColumn: number;
  /** End line of the step (1-indexed) */
  stepEndLine: number;
  /** Detected indent size (spaces per level) */
  indentSize: number;
  /** Information about existing with: block, if present */
  withInfo?: {
    keyColumn: number;
    keyEndLine: number;
    valueEndLine: number;
    hasChildren: boolean;
    /** Column of first child input (1-indexed), for indentation detection */
    firstChildColumn?: number;
  };
}

export const addMissingInputsProvider: CodeActionProvider = {
  diagnosticCodes: [DiagnosticCode.MissingRequiredInputs],

  createCodeAction(context: CodeActionContext, diagnostic): CodeAction | undefined {
    const data = diagnostic.data as MissingInputsDiagnosticData | undefined;
    if (!data) {
      return undefined;
    }

    // Parse the document to get the step token
    const stepInfo = getStepInfo(context, diagnostic.range.start);
    if (!stepInfo) {
      return undefined;
    }

    const edits = createInputEdits(data.missingInputs, stepInfo);
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
 * Parse the document and extract step information needed for generating edits.
 * Returns undefined if parsing fails or the step token cannot be found.
 */
function getStepInfo(context: CodeActionContext, diagnosticPosition: Position): StepInfo | undefined {
  // Parse the document (uses cache if available from validation)
  const file = {name: context.uri, content: context.documentContent};
  const parseResult = getOrParseWorkflow(file, context.uri);

  if (!parseResult.value) {
    error("Failed to parse workflow for missing inputs quickfix");
    return undefined;
  }

  // Find the token at the diagnostic position
  const {path} = findToken(diagnosticPosition, parseResult.value);

  // Walk up the path to find the step token (regular-step)
  const stepToken = findStepInPath(path);
  if (!stepToken) {
    error("Could not find step token for missing inputs quickfix");
    return undefined;
  }

  return extractStepInfo(stepToken);
}

/**
 * Find the step token (regular-step) in the token path
 */
function findStepInPath(path: TemplateToken[]): MappingToken | undefined {
  // Walk backwards through path to find the step
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i].definition?.key === "regular-step" && isMapping(path[i])) {
      return path[i] as MappingToken;
    }
  }
  return undefined;
}

/**
 * Extract position and indentation info from a step token
 */
function extractStepInfo(stepToken: MappingToken): StepInfo | undefined {
  if (!stepToken.range) {
    return undefined;
  }

  // Get the column of the first key in the step
  let stepKeyColumn = stepToken.range.start.column;
  if (stepToken.count > 0) {
    const firstEntry = stepToken.get(0);
    if (firstEntry?.key.range) {
      stepKeyColumn = firstEntry.key.range.start.column;
    }
  }

  // Find the with: block if present
  let withKey: ScalarToken | undefined;
  let withToken: TemplateToken | undefined;
  for (const {key, value} of stepToken) {
    if (key.toString() === "with") {
      withKey = key;
      withToken = value;
      break;
    }
  }

  // Calculate indent size
  let indentSize = 2; // Default
  let withInfo: StepInfo["withInfo"];

  if (withKey?.range && withToken?.range) {
    // Has with: block - extract its info
    const hasChildren = isMapping(withToken) && withToken.count > 0;
    let firstChildColumn: number | undefined;

    if (hasChildren) {
      const firstChild = (withToken as MappingToken).get(0);
      if (firstChild?.key.range) {
        firstChildColumn = firstChild.key.range.start.column;
        // Detect indent size from with: children
        indentSize = firstChildColumn - withKey.range.start.column;
      }
    }

    withInfo = {
      keyColumn: withKey.range.start.column,
      keyEndLine: withKey.range.end.line,
      valueEndLine: withToken.range.end.line,
      hasChildren,
      firstChildColumn
    };
  } else {
    // No with: block - detect indent size using heuristics
    // Based on the step key column position, estimate indent size
    // 2-space indent files typically have step keys at column 7
    // 4-space indent files typically have step keys at column 15
    const zeroIndexedCol = stepKeyColumn - 1;
    if (zeroIndexedCol >= 10) {
      indentSize = 4;
    }
  }

  return {
    stepKeyColumn,
    stepEndLine: stepToken.range.end.line,
    indentSize,
    withInfo
  };
}

/**
 * Generate text edits to add missing inputs
 */
function createInputEdits(missingInputs: MissingInputsDiagnosticData["missingInputs"], stepInfo: StepInfo): TextEdit[] {
  const formatInputLines = (indent: string) =>
    missingInputs.map(input => {
      const value = input.default ?? '""';
      return `${indent}${input.name}: ${value}`;
    });

  if (stepInfo.withInfo) {
    // `with:` exists - add inputs to existing block
    const withIndent = stepInfo.withInfo.keyColumn - 1; // 0-indexed
    const inputIndentSize = stepInfo.withInfo.firstChildColumn
      ? stepInfo.withInfo.firstChildColumn - stepInfo.withInfo.keyColumn
      : stepInfo.indentSize;

    const inputIndent = " ".repeat(withIndent + inputIndentSize);
    const inputLines = formatInputLines(inputIndent);

    // Calculate insert position
    let insertLine: number;
    if (stepInfo.withInfo.hasChildren) {
      // Insert after the last child (at end of with: block)
      // valueEndLine is 1-indexed, we want 0-indexed for Position
      insertLine = stepInfo.withInfo.valueEndLine - 1;
    } else {
      // Empty with: block - insert on the next line after with:
      // keyEndLine is 1-indexed, convert to 0-indexed and go to next line
      insertLine = stepInfo.withInfo.keyEndLine;
    }

    const insertPosition: Position = {
      line: insertLine,
      character: 0
    };

    return [
      {
        range: {start: insertPosition, end: insertPosition},
        newText: inputLines.map(line => line + "\n").join("")
      }
    ];
  } else {
    // No `with:` key - add `with:` at the same level as other step keys
    const withKeyIndent = stepInfo.stepKeyColumn - 1; // 0-indexed (columns are 1-based)

    const withIndent = " ".repeat(withKeyIndent);
    const inputIndent = " ".repeat(withKeyIndent + stepInfo.indentSize);
    const inputLines = formatInputLines(inputIndent);

    const newText = `${withIndent}with:\n` + inputLines.map(line => `${line}\n`).join("");

    // Insert at end of step
    // stepEndLine is 1-indexed, we want 0-indexed and insert before the line after
    const insertPosition: Position = {
      line: stepInfo.stepEndLine - 1,
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
