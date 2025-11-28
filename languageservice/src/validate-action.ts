import { isMapping } from "@actions/workflow-parser";
import { isActionStep } from "@actions/workflow-parser/model/type-guards";
import { Step } from "@actions/workflow-parser/model/workflow-template";
import { ScalarToken } from "@actions/workflow-parser/templates/tokens/scalar-token";
import { TemplateToken } from "@actions/workflow-parser/templates/tokens/template-token";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";
import { ActionReference, parseActionReference } from "./action";
import { mapRange } from "./utils/range";
import { ValidationConfig } from "./validate";

export const DiagnosticCode = {
  MissingRequiredInputs: "missing-required-inputs"
} as const;

export interface MissingInputsDiagnosticData {
  action: ActionReference;
  missingInputs: Array<{
    name: string;
    default?: string;
  }>;
  hasWithKey: boolean;
  // Indentation of the `with:` key if present, or the step's base indentation
  withIndent?: number;
  stepIndent: number;
  // Position where new content should be inserted
  insertPosition: { line: number; character: number };
}

export async function validateAction(
  diagnostics: Diagnostic[],
  stepToken: TemplateToken,
  step: Step | undefined,
  config: ValidationConfig | undefined
): Promise<void> {
  if (!isMapping(stepToken) || !step || !isActionStep(step) || !config?.actionsMetadataProvider) {
    return;
  }

  const action = parseActionReference(step.uses.value);
  if (!action) {
    return;
  }

  const actionMetadata = await config.actionsMetadataProvider.fetchActionMetadata(action);
  if (actionMetadata === undefined) {
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: mapRange(step.uses.range),
      message: `Unable to resolve action \`${step.uses.value}\`, repository or version not found`
    });
    return;
  }

  let withKey: ScalarToken | undefined;
  let withToken: TemplateToken | undefined;
  for (const { key, value } of stepToken) {
    if (key.toString() === "with") {
      withKey = key;
      withToken = value;
      break;
    }
  }

  const stepInputs = new Map<string, ScalarToken>();
  if (withToken && isMapping(withToken)) {
    for (const { key } of withToken) {
      stepInputs.set(key.toString(), key);
    }
  }

  const actionInputs = actionMetadata.inputs;
  if (actionInputs === undefined) {
    return;
  }

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

  const missingRequiredInputs = Object.entries(actionInputs).filter(
    ([inputName, input]) => input.required && !stepInputs.has(inputName) && input.default === undefined
  );

  if (missingRequiredInputs.length > 0) {
    const message =
      missingRequiredInputs.length === 1
        ? `Missing required input \`${missingRequiredInputs[0][0]}\``
        : `Missing required inputs: ${missingRequiredInputs.map(input => `\`${input[0]}\``).join(", ")}`;

    const stepIndent = stepToken.range ? stepToken.range.start.column - 1 : 0; // 0-indexed
    const withIndent = withKey?.range ? withKey.range.start.column - 1 : undefined;

    // Calculate insert position
    // For withToken, we need to handle empty mappings specially - insert after the with: line
    let insertPosition: { line: number; character: number };
    if (withToken?.range) {
      // Check if with: has any children by comparing start and end lines
      const hasChildren = stepInputs.size > 0;
      if (hasChildren) {
        // Insert after the last child
        insertPosition = { line: withToken.range.end.line - 1, character: 0 };
      } else {
        // Empty with: block - insert on the next line after with:
        insertPosition = { line: withKey!.range!.end.line, character: 0 };
      }
    } else if (stepToken.range) {
      insertPosition = { line: stepToken.range.end.line - 1, character: 0 };
    } else {
      insertPosition = { line: 0, character: 0 };
    }

    const diagnosticData: MissingInputsDiagnosticData = {
      action,
      missingInputs: missingRequiredInputs.map(([name, input]) => ({
        name,
        default: input.default
      })),
      hasWithKey: withKey !== undefined,
      withIndent,
      stepIndent,
      insertPosition
    };

    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: mapRange((withKey || stepToken).range), // Highlight the whole step if we don't have a with key
      message: message,
      code: DiagnosticCode.MissingRequiredInputs,
      data: diagnosticData
    });
  }
}
