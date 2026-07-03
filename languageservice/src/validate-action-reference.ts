import {isMapping} from "@actions/workflow-parser";
import {isActionStep} from "@actions/workflow-parser/model/type-guards";
import {Step} from "@actions/workflow-parser/model/workflow-template";
import {ScalarToken} from "@actions/workflow-parser/templates/tokens/scalar-token";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";
import {TokenRange} from "@actions/workflow-parser/templates/tokens/token-range";
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

  // Self-reference ($/path): resolve the action from the same repository as the executing
  // workflow/action. The target directory must contain an `action.yml` or `action.yaml`.
  if (uses.startsWith("$/")) {
    await validateSelfActionReference(diagnostics, step.uses.value, step.uses.range, config);
    return;
  }

  if (!config?.actionsMetadataProvider) {
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
 * Validates a self-reference (`$/path`) action `uses` value by resolving the referenced
 * action within the same repository. The target directory must contain an `action.yml` or
 * `action.yaml` manifest.
 *
 * The existence check requires a `FileProvider` (the same mechanism used to resolve reusable
 * workflows). When no `FileProvider` is configured, the check is skipped so we don't emit a
 * false error. Format-level problems (empty path, `@ref`) are reported by
 * `validateStepUsesFormat`, so this only runs for well-formed self-references.
 */
async function validateSelfActionReference(
  diagnostics: Diagnostic[],
  uses: string,
  range: TokenRange | undefined,
  config: ValidationConfig | undefined
): Promise<void> {
  const fileProvider = config?.fileProvider;
  if (!fileProvider) {
    return;
  }

  const path = uses.substring("$/".length);

  // Skip malformed self-references (empty path or a trailing @ref); those are reported by
  // validateStepUsesFormat.
  if (!path || uses.includes("@")) {
    return;
  }

  for (const manifest of ["action.yml", "action.yaml"]) {
    try {
      await fileProvider.getFileContent({path: `${path}/${manifest}`});
      return; // Found a valid action manifest
    } catch {
      // Try the next manifest filename
    }
  }

  diagnostics.push({
    severity: DiagnosticSeverity.Error,
    range: mapRange(range),
    message: `Unable to resolve action \`${uses}\`, no 'action.yml' or 'action.yaml' found in '${path}'`,
    code: "invalid-uses-format"
  });
}
