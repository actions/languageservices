import {MappingToken} from "@github/actions-workflow-parser/templates/tokens/mapping-token";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {isMapping, isString} from "@github/actions-workflow-parser/templates/tokens/type-guards";
import {WorkflowContext} from "../context/workflow-context";
import {Value} from "./config";
import {stringsToValues} from "./strings-to-values";

export function reusableJobInputs(context: WorkflowContext): Value[] {
  if (!context.reusableWorkflowJob?.["input-definitions"]) {
    return [];
  }

  const values: Value[] = [];

  for (const {key, value} of context.reusableWorkflowJob["input-definitions"]) {
    if (!isString(key)) {
      continue;
    }

    values.push({
      label: key.value,
      description: inputDescription(value)
    });
  }

  return values;
}

function inputDescription(inputDef: TemplateToken): string | undefined {
  if (!isMapping(inputDef)) {
    return undefined;
  }

  const descriptionToken = inputDef.find("description");
  if (!descriptionToken || !isString(descriptionToken)) {
    return undefined;
  }

  return descriptionToken.value;
}
