import {isMapping} from "@actions/workflow-parser";
import {isActionStep} from "@actions/workflow-parser/model/type-guards";
import {Step} from "@actions/workflow-parser/model/workflow-template";
import {MappingToken} from "@actions/workflow-parser/templates/tokens/mapping-token";
import {ScalarToken} from "@actions/workflow-parser/templates/tokens/scalar-token";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";
import {TokenRange} from "@actions/workflow-parser/templates/tokens/token-range";
import {Diagnostic, DiagnosticSeverity} from "vscode-languageserver-types";
import {parse} from "yaml";
import {ActionMetadata, ActionReference, parseActionReference} from "./action.js";
import {mapRange} from "./utils/range.js";
import {ValidationConfig} from "./validate.js";

export const DiagnosticCode = {
  MissingRequiredInputs: "missing-required-inputs"
} as const;

export interface MissingInputsDiagnosticData {
  action?: ActionReference;
  missingInputs: Array<{
    name: string;
    default?: string;
  }>;
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
  if (!isMapping(stepToken) || !step || !isActionStep(step)) {
    return;
  }

  const uses = step.uses.value;
  let action: ActionReference | undefined;
  let actionMetadata: ActionMetadata | undefined;

  if (uses.startsWith("$/")) {
    actionMetadata = await fetchSelfRepositoryActionMetadata(diagnostics, uses, step.uses.range, config);
  } else {
    if (!config?.actionsMetadataProvider) {
      return;
    }

    // Parse the action reference (e.g., "actions/checkout@v4" -> {owner, name, ref})
    action = parseActionReference(uses);
    if (!action) {
      return;
    }

    // Fetch the action's metadata (action.yml) to get input definitions
    actionMetadata = await config.actionsMetadataProvider.fetchActionMetadata(action);
    if (actionMetadata === undefined) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: mapRange(step.uses.range),
        message: `Unable to resolve action \`${uses}\`, repository or version not found`
      });
      return;
    }
  }

  if (actionMetadata === undefined) {
    return;
  }

  validateActionInputs(diagnostics, stepToken, actionMetadata, action);
}

function validateActionInputs(
  diagnostics: Diagnostic[],
  stepToken: MappingToken,
  actionMetadata: ActionMetadata,
  action: ActionReference | undefined
): void {
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
      ...(action ? {action} : {}),
      missingInputs: missingRequiredInputs.map(([name, input]) => ({
        name,
        default: input.default
      }))
    };

    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: mapRange((withKey || stepToken).range),
      message: message,
      code: DiagnosticCode.MissingRequiredInputs,
      data: diagnosticData
    });
  }
}

/**
 * Fetches metadata for a self repository (`$/path`) action from the same repository.
 *
 * Resolution requires a `FileProvider`, the same mechanism used for reusable workflows. When
 * none is configured, validation is skipped to avoid a false error. Format-level problems are
 * reported by `validateStepUsesFormat`.
 */
async function fetchSelfRepositoryActionMetadata(
  diagnostics: Diagnostic[],
  uses: string,
  range: TokenRange | undefined,
  config: ValidationConfig | undefined
): Promise<ActionMetadata | undefined> {
  const fileProvider = config?.fileProvider;
  if (!fileProvider) {
    return;
  }

  const path = uses.substring("$/".length);

  // Skip malformed self repository references (empty path or a trailing @ref); those are reported by
  // validateStepUsesFormat.
  if (!path || uses.includes("@")) {
    return;
  }

  let content: string | undefined;
  for (const manifest of ["action.yml", "action.yaml"]) {
    try {
      const file = await fileProvider.getFileContent({path: `${path}/${manifest}`});
      content = file.content;
      break;
    } catch {
      // Try the next manifest filename
    }
  }

  if (content !== undefined) {
    return parse(content) as ActionMetadata;
  }

  diagnostics.push({
    severity: DiagnosticSeverity.Error,
    range: mapRange(range),
    message: `Unable to resolve action \`${uses}\`, no 'action.yml' or 'action.yaml' found in '${path}'`,
    code: "invalid-uses-format"
  });
}
