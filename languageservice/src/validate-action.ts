import {isMapping} from "@github/actions-workflow-parser";
import {isActionStep} from "@github/actions-workflow-parser/model/type-guards";
import {Step} from "@github/actions-workflow-parser/model/workflow-template";
import {ScalarToken} from "@github/actions-workflow-parser/templates/tokens/scalar-token";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {Diagnostic, DiagnosticSeverity} from "vscode-languageserver-types";
import {parseActionReference} from "./action";
import {mapRange} from "./utils/range";
import {ValidationConfig} from "./validate";

export async function validateAction(
  diagnostics: Diagnostic[],
  stepToken: TemplateToken,
  step: Step | undefined,
  config: ValidationConfig | undefined
): Promise<void> {
  if (!isMapping(stepToken) || !step || !isActionStep(step) || !config?.fetchActionMetadata) {
    return;
  }

  const action = parseActionReference(step.uses.value);
  if (!action) {
    return;
  }

  const actionMetadata = await config.fetchActionMetadata(action);
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
  for (const {key, value} of stepToken) {
    if (key.toString() === "with") {
      withKey = key;
      withToken = value;
      break;
    }
  }

  const stepInputs = new Map<string, ScalarToken>();
  if (withToken && isMapping(withToken)) {
    for (const {key} of withToken) {
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
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: mapRange((withKey || stepToken).range), // Highlight the whole step if we don't have a with key
      message: message
    });
  }
}
