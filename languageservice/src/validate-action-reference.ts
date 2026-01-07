import {isMapping} from "@actions/workflow-parser";
import {isActionStep} from "@actions/workflow-parser/model/type-guards";
import {Step} from "@actions/workflow-parser/model/workflow-template";
import {ScalarToken} from "@actions/workflow-parser/templates/tokens/scalar-token";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";
import {Diagnostic, DiagnosticSeverity} from "vscode-languageserver-types";
import {ActionReference, parseActionReference} from "./action.js";
import {mapRange} from "./utils/range.js";
import {ValidationConfig} from "./validate.js";

export const DiagnosticCode = {
  MissingRequiredInputs: "missing-required-inputs"
} as const;

export interface MissingInputsDiagnosticData {
  action: ActionReference;
  missingInputs: Array<{
    name: string;
    default?: string;
  }>;
  // Step token range for position calculation in quickfix
  stepRange: {
    start: {line: number; column: number};
    end: {line: number; column: number};
  };
  // Column of the first key in the step (e.g., "uses"), used for with: placement
  firstStepKeyColumn?: number;
  // With token info if present
  withInfo?: {
    keyRange: {
      start: {line: number; column: number};
      end: {line: number; column: number};
    };
    valueRange: {
      start: {line: number; column: number};
      end: {line: number; column: number};
    };
    hasChildren: boolean;
    // If has children, the first child's column for indentation detection
    firstChildColumn?: number;
  };
  // Detected indent size from the document structure (fallback to 2 if not detectable)
  indentSize: number;
}

/**
 * Validates action references in workflow steps, checking for valid inputs and required inputs.
 */
export async function validateActionReference(
  diagnostics: Diagnostic[],
  stepToken: TemplateToken,
  step: Step | undefined,
  config: ValidationConfig | undefined
): Promise<void> {
  if (!isMapping(stepToken) || !step || !isActionStep(step) || !config?.actionsMetadataProvider) {
    return;
  }

  // Parse the action reference (e.g., "actions/checkout@v4" -> {owner, name, ref})
  const action = parseActionReference(step.uses.value);
  if (!action) {
    return;
  }

  // Fetch the action's metadata (action.yml) to get input definitions
  const actionMetadata = await config.actionsMetadataProvider.fetchActionMetadata(action);
  if (actionMetadata === undefined) {
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: mapRange(step.uses.range),
      message: `Unable to resolve action \`${step.uses.value}\`, repository or version not found`
    });
    return;
  }

  // Find the "with" key in the step token to get the inputs passed to the action
  let withKey: ScalarToken | undefined;
  let withToken: TemplateToken | undefined;
  for (const {key, value} of stepToken) {
    if (key.toString() === "with") {
      withKey = key;
      withToken = value;
      break;
    }
  }

  // Collect the inputs provided in the step's "with" block
  const stepInputs = new Map<string, ScalarToken>();
  if (withToken && isMapping(withToken)) {
    for (const {key} of withToken) {
      stepInputs.set(key.toString(), key);
    }
  }

  // Skip validation if the action doesn't define any inputs
  const actionInputs = actionMetadata.inputs;
  if (actionInputs === undefined) {
    return;
  }

  // Check each provided input is valid and not deprecated
  for (const [input, inputToken] of stepInputs) {
    if (!actionInputs[input]) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: mapRange(inputToken.range),
        message: `Invalid action input '${input}'`
      });
    }

    const deprecationMessage = actionInputs[input]?.deprecationMessage;
    if (deprecationMessage) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: mapRange(inputToken.range),
        message: deprecationMessage
      });
    }
  }

  // Check for required inputs that weren't provided and don't have defaults
  const missingRequiredInputs = Object.entries(actionInputs).filter(
    ([inputName, input]) => input.required && !stepInputs.has(inputName) && input.default === undefined
  );

  // Report missing required inputs
  if (missingRequiredInputs.length > 0) {
    const message =
      missingRequiredInputs.length === 1
        ? `Missing required input \`${missingRequiredInputs[0][0]}\``
        : `Missing required inputs: ${missingRequiredInputs.map(input => `\`${input[0]}\``).join(", ")}`;

    // Build minimal diagnostic data - position calculation happens in the quickfix
    const diagnosticData: MissingInputsDiagnosticData = {
      action,
      missingInputs: missingRequiredInputs.map(([name, input]) => ({
        name,
        default: input.default
      })),
      stepRange: stepToken.range
        ? {
            start: {line: stepToken.range.start.line, column: stepToken.range.start.column},
            end: {line: stepToken.range.end.line, column: stepToken.range.end.column}
          }
        : {start: {line: 0, column: 0}, end: {line: 0, column: 0}},
      indentSize: 2 // Default, will be updated below if we can detect it
    };

    // Get the column of the first key in the step for with: placement
    if (stepToken.count > 0) {
      const firstEntry = stepToken.get(0);
      if (firstEntry?.key.range) {
        diagnosticData.firstStepKeyColumn = firstEntry.key.range.start.column;
      }
    }

    // Add with: info if present and detect indent size from it
    if (withKey?.range && withToken?.range) {
      let firstChildColumn: number | undefined;
      if (withToken && isMapping(withToken) && withToken.count > 0) {
        const firstChild = withToken.get(0);
        if (firstChild?.key.range) {
          firstChildColumn = firstChild.key.range.start.column;
          // Detect indent size from with: children
          diagnosticData.indentSize = firstChildColumn - withKey.range.start.column;
        }
      }

      diagnosticData.withInfo = {
        keyRange: {
          start: {line: withKey.range.start.line, column: withKey.range.start.column},
          end: {line: withKey.range.end.line, column: withKey.range.end.column}
        },
        valueRange: {
          start: {line: withToken.range.start.line, column: withToken.range.start.column},
          end: {line: withToken.range.end.line, column: withToken.range.end.column}
        },
        hasChildren: stepInputs.size > 0,
        firstChildColumn
      };
    } else if (stepToken.count >= 1) {
      // No with:, try to detect indent size from the step's keys
      // Use a heuristic based on the key column position
      const firstKeyCol = diagnosticData.firstStepKeyColumn;
      if (firstKeyCol) {
        // Common positions for step content (after `- ` prefix):
        // 2-space indent: columns 5, 7, 9, 11, ... (odd after 3)
        // 4-space indent: columns 7, 11, 15, 19, ... (pattern of 4n+3)
        //
        // For a step in a workflow at typical nesting:
        // - 2-space at jobs.job.steps.step: column 7
        // - 4-space at jobs.job.steps.step: column 15
        //
        // Heuristic: if column > 11 and fits 4-space pattern, use 4-space
        const zeroIndexedPos = firstKeyCol - 1;
        // 4-space indent pattern: positions 6, 14, 22, 30... (0-indexed: 6 + 8n)
        // which translates to columns 7, 15, 23, 31... (1-indexed)
        // These are positions where (col - 7) % 8 === 0 OR col === 7 doesn't help distinguish
        //
        // Better: 4-space files typically have step content at column 15+ for normal nesting
        // 2-space files have step content at column 7 for same nesting
        if (zeroIndexedPos >= 10) {
          // Only assume 4-space for deeper indentation
          diagnosticData.indentSize = 4;
        }
        // Otherwise keep default of 2
      }
    }

    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: mapRange((withKey || stepToken).range), // Highlight the whole step if we don't have a with key
      message: message,
      code: DiagnosticCode.MissingRequiredInputs,
      data: diagnosticData
    });
  }
}
