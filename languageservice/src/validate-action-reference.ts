import {isMapping} from "@actions/workflow-parser";
import {isActionStep} from "@actions/workflow-parser/model/type-guards";
import {Step} from "@actions/workflow-parser/model/workflow-template";
import {ScalarToken} from "@actions/workflow-parser/templates/tokens/scalar-token";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";
import {Diagnostic, DiagnosticSeverity} from "vscode-languageserver-types";
import {parseActionReference} from "./action.js";
import {mapRange} from "./utils/range.js";
import {ValidationConfig} from "./validate.js";

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
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: mapRange((withKey || stepToken).range), // Highlight the whole step if we don't have a with key
      message: message
    });
  }
}
