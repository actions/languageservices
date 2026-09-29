import {TemplateContext} from "../../templates/template-context.js";
import {MappingToken} from "../../templates/tokens/mapping-token.js";
import {ScalarToken} from "../../templates/tokens/scalar-token.js";
import {InputConfig, InputType, WorkflowDispatchConfig} from "../workflow-template.js";
import {convertStringList} from "./string-list.js";

export function convertEventWorkflowDispatchInputs(
  context: TemplateContext,
  token: MappingToken
): WorkflowDispatchConfig {
  const result: WorkflowDispatchConfig = {};

  for (const item of token) {
    const key = item.key.assertString("workflow dispatch input key");

    switch (key.value) {
      case "inputs":
        result.inputs = convertWorkflowDispatchInputs(context, item.value.assertMapping("workflow dispatch inputs"));
        break;
    }
  }

  return result;
}

export function convertWorkflowDispatchInputs(
  context: TemplateContext,
  token: MappingToken
): {
  [inputName: string]: InputConfig;
} {
  const result: {[inputName: string]: InputConfig} = {};

  for (const item of token) {
    const inputName = item.key.assertString("input name");
    const inputMapping = item.value.assertMapping("input configuration");

    result[inputName.value] = convertWorkflowDispatchInput(context, inputMapping);
  }

  return result;
}

export function convertWorkflowDispatchInput(context: TemplateContext, token: MappingToken): InputConfig {
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
  if (defaultValue !== undefined) {
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
