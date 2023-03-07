import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {isMapping, isString} from "@github/actions-workflow-parser/templates/tokens/type-guards";
import {WorkflowContext} from "../context/workflow-context";
import {Value} from "./config";

export function reusableJobSecrets(context: WorkflowContext, existingValues?: Set<string>): Value[] {
  if (!context.reusableWorkflowJob) {
    return [];
  }

  const values: Value[] = [];

  const inheritSecrets = context.reusableWorkflowJob["inherit-secrets"];
  if (inheritSecrets) {
    return values;
  }

  // Suggest inherit if no other secrets have been set
  if (!existingValues || existingValues.size === 0) {
    values.push({
      label: "inherit"
    });
  }

  if (context.reusableWorkflowJob?.["secret-definitions"]) {
    for (const {key, value} of context.reusableWorkflowJob["secret-definitions"]) {
      if (!isString(key)) {
        continue;
      }

      values.push({
        label: key.value,
        description: secretDescription(value),
        insertText: `${key.value}: `
      });
    }
  }

  return values;
}

function secretDescription(secretDef: TemplateToken): string | undefined {
  if (!isMapping(secretDef)) {
    return "";
  }

  const descriptionToken = secretDef.find("description");
  if (!descriptionToken || !isString(descriptionToken)) {
    return "";
  }

  return descriptionToken.value;
}
