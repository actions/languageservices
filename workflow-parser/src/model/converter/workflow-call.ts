import {TemplateContext} from "../../templates/template-context";
import {MappingToken, TemplateToken} from "../../templates/tokens";
import {isMapping} from "../../templates/tokens/type-guards";
import {SecretConfig, WorkflowCallConfig} from "../workflow-template";

export function convertEventWorkflowCall(context: TemplateContext, token: MappingToken): WorkflowCallConfig {
  const result: WorkflowCallConfig = {};

  for (const item of token) {
    const key = item.key.assertString("workflow dispatch input key");

    switch (key.value) {
      case "inputs":
        // Ignore, these are handled by convertEventWorkflowDispatchInputs
        break;

      case "secrets":
        result.secrets = convertWorkflowCallSecrets(context, item.value.assertMapping("workflow dispatch inputs"));
        break;

      case "outputs":
        // TODO - outputs
        break;
    }
  }

  return result;
}

function convertWorkflowCallSecrets(
  context: TemplateContext,
  token: MappingToken
): {[secretName: string]: SecretConfig} {
  const result: {[secretName: string]: SecretConfig} = {};

  for (const item of token) {
    const secretName = item.key.assertString("secret name");

    result[secretName.value] = convertWorkflowCallSecret(context, item.value);
  }

  return result;
}

function convertWorkflowCallSecret(context: TemplateContext, token: TemplateToken): SecretConfig {
  const result: SecretConfig = {};

  if (isMapping(token)) {
    for (const item of token) {
      const key = item.key.assertString("workflow call secret key");

      switch (key.value) {
        case "description":
          result.description = item.value.assertString("secret description").value;
          break;

        case "required":
          result.required = item.value.assertBoolean("secret required").value;
          break;
      }
    }
  }

  return result;
}
