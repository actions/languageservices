import * as fs from "fs";
import * as path from "path";
import { TextEdit } from "vscode-languageserver-types";
import { TextDocument } from "vscode-languageserver-textdocument";
import { validate, ValidationConfig } from "../../validate";
import { getCodeActions, CodeActionParams } from "../index";

// Marker pattern: # want "diagnostic message" fix="code-action-name"
const MARKER_PATTERN = /#\s*want\s+"([^"]+)"(?:\s+fix="([^"]+)")?/;

export interface TestCase {
  name: string;
  inputPath: string;
  goldenPath: string;
  input: string;
  golden: string;
  markers: Marker[];
}

export interface Marker {
  line: number;
  message: string;
  fix?: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  expected?: string;
  actual?: string;
}

/**
 * Parse markers from input file content
 */
export function parseMarkers(content: string): Marker[] {
  const lines = content.split("\n");
  const markers: Marker[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(MARKER_PATTERN);
    if (match) {
      markers.push({
        line: i,
        message: match[1],
        fix: match[2],
      });
    }
  }

  return markers;
}

/**
 * Strip markers from content (for processing)
 */
export function stripMarkers(content: string): string {
  return content
    .split("\n")
    .map(line => line.replace(MARKER_PATTERN, "").trimEnd())
    .join("\n");
}

/**
 * Load all test cases from a testdata directory
 */
export function loadTestCases(testdataDir: string): TestCase[] {
  const testCases: TestCase[] = [];

  function walkDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".yml") && !entry.name.endsWith(". golden.yml")) {
        const goldenPath = fullPath.replace(".yml", ".golden.yml");

        if (fs.existsSync(goldenPath)) {
          const input = fs.readFileSync(fullPath, "utf-8");
          const golden = fs.readFileSync(goldenPath, "utf-8");

          testCases.push({
            name: path.relative(testdataDir, fullPath),
            inputPath: fullPath,
            goldenPath,
            input,
            golden,
            markers: parseMarkers(input),
          });
        }
      }
    }
  }

  walkDir(testdataDir);
  return testCases;
}

/**
 * Apply text edits to a document
 */
export function applyEdits(content: string, edits: TextEdit[]): string {
  // Sort edits in reverse order by position to apply from bottom to top
  const sortedEdits = [...edits].sort((a, b) => {
    if (b.range.start.line !== a.range.start.line) {
      return b.range.start.line - a.range.start.line;
    }
    return b.range.start.character - a.range.start.character;
  });

  const lines = content.split("\n");

  for (const edit of sortedEdits) {
    const startLine = edit.range.start.line;
    const startChar = edit.range.start.character;
    const endLine = edit.range.end.line;
    const endChar = edit.range.end.character;

    const before = lines[startLine].slice(0, startChar);
    const after = lines[endLine].slice(endChar);

    const newLines = edit.newText.split("\n");
    newLines[0] = before + newLines[0];
    newLines[newLines.length - 1] = newLines[newLines.length - 1] + after;

    lines.splice(startLine, endLine - startLine + 1, ...newLines);
  }

  return lines.join("\n");
}

/**
 * Run a single test case
 */
export async function runTestCase(
  testCase: TestCase,
  validationConfig: ValidationConfig
): Promise<TestResult> {
  const strippedInput = stripMarkers(testCase.input);
  const document = TextDocument.create("file:///test.yml", "yaml", 1, strippedInput);

  // 1. Validate and get diagnostics
  const diagnostics = await validate(document, validationConfig);

  // 2.  Verify all expected diagnostics are present
  const missingDiagnostics: string[] = [];
  for (const marker of testCase.markers) {
    const found = diagnostics.find(
      d => d.range.start.line === marker.line && d.message.includes(marker.message)
    );
    if (!found) {
      missingDiagnostics.push(`line ${marker.line}: "${marker.message}"`);
    }
  }

  if (missingDiagnostics.length > 0) {
    return {
      name: testCase.name,
      passed: false,
      error: `Missing expected diagnostics:\n  ${missingDiagnostics.join("\n  ")}\n\nActual diagnostics:\n  ${diagnostics.map(d => `line ${d.range.start.line}: "${d.message}"`).join("\n  ")}`,
    };
  }

  // 3.  Collect all edits from all matching code actions
  const allEdits: TextEdit[] = [];

  for (const marker of testCase.markers) {
    if (!marker.fix) {
      continue;
    }

    const diagnostic = diagnostics.find(
      d => d.range.start.line === marker.line && d.message.includes(marker.message)
    );

    if (!diagnostic) {
      continue; // Already reported above
    }

    const params: CodeActionParams = {
      uri: document.uri,
      diagnostics: [diagnostic],
    };

    const actions = getCodeActions(params);
    const matchingAction = actions.find(a =>
      a.title.toLowerCase().includes(marker.fix!.toLowerCase())
    );

    if (!matchingAction) {
      return {
        name: testCase.name,
        passed: false,
        error: `Code action "${marker.fix}" not found for diagnostic on line ${marker.line}.\nAvailable actions: ${actions.map(a => a.title).join(", ") || "(none)"}`,
      };
    }

    if (!matchingAction.edit?.changes) {
      return {
        name: testCase.name,
        passed: false,
        error: `Code action "${marker.fix}" has no edits`,
      };
    }

    const edits = matchingAction.edit.changes[document.uri] || [];
    allEdits.push(...edits);
  }

  // 4. Apply all edits and compare to golden file
  const actualOutput = applyEdits(strippedInput, allEdits);
  const expectedOutput = testCase.golden;

  if (actualOutput.trim() !== expectedOutput.trim()) {
    return {
      name: testCase.name,
      passed: false,
      error: "Output does not match golden file",
      expected: expectedOutput,
      actual: actualOutput,
    };
  }

  return {
    name: testCase.name,
    passed: true,
  };
}
