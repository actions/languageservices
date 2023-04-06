import {TemplateContext} from "../../templates/template-context";
import {MappingToken, TemplateToken} from "../../templates/tokens";
import {isMapping} from "../../templates/tokens/type-guards";
import {SecretConfig, WorkflowCallConfig, InputConfig, InputType} from "../workflow-template";
import {convertStringList} from "./string-list";
import {ScalarToken} from "../../templates/tokens/scalar-token";

export function convertEventWorkflowCall(context: TemplateContext, token: MappingToken): WorkflowCallConfig {
  const result: WorkflowCallConfig = {};

  for (const item of token) {
    const key = item.key.assertString("workflow dispatch input key");

    switch (key.value) {
      case "inputs":
        result.inputs = convertWorkflowInputs(context, item.value.assertMapping("workflow dispatch inputs"));
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

export function convertWorkflowInputs(
  context: TemplateContext,
  token: MappingToken
): {
  [inputName: string]: InputConfig;
} {
  const result: {[inputName: string]: InputConfig} = {};

  for (const item of token) {
    const inputName = item.key.assertString("input name");
    const inputMapping = item.value.assertMapping("input configuration");

    result[inputName.value] = convertWorkflowInput(context, inputMapping);
  }

  return result;
}

export function convertWorkflowInput(context: TemplateContext, token: MappingToken): InputConfig {
  const result: InputConfig = {
    type: InputType.string // Default to string
  };

  let defaultValue: undefined | ScalarToken;

  for (const item of token) {
    const key = item.key.assertString("workflow dispatch input key");

    switch (key.value) {
      case "description":
        result.description = item.value.assertString("input description").value;
        break;

      case "required":
        result.required = item.value.assertBoolean("input required").value;
        break;

      case "default":
        defaultValue = item.value.assertScalar("input default");
        break;

      case "type":
        result.type = InputType[item.value.assertString("input type").value as keyof typeof InputType];
        break;

      case "options":
        result.options = convertStringList("input options", item.value.assertSequence("input options"));
        break;

      default:
        context.error(item.key, `Invalid key '${key.value}'`);
    }
  }

  // Validate default value
  if (defaultValue !== undefined && !defaultValue.isExpression) {
    try {
      switch (result.type) {
        case InputType.boolean:
          result.default = defaultValue.assertBoolean("input default").value;

          break;

        case InputType.string:
        case InputType.choice:
        case InputType.environment:
          result.default = defaultValue.assertString("input default").value;
          break;
      }
    } catch (e) {
      context.error(defaultValue, e);
    }
  }

  // Validate `options` for `choice` type
  if (result.type === InputType.choice) {
    if (result.options === undefined || result.options.length === 0) {
      context.error(token, "Missing 'options' for choice input");
    }
  } else {
    if (result.options !== undefined) {
      context.error(token, "Input type is not 'choice', but 'options' is defined");
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
