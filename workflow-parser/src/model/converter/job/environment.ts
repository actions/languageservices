import {FeatureFlags} from "@actions/expressions/features";
import {TemplateContext} from "../../../templates/template-context.js";
import {TemplateToken} from "../../../templates/tokens/template-token.js";
import {isScalar} from "../../../templates/tokens/type-guards.js";
import {ActionsEnvironmentReference} from "../../workflow-template.js";

export function convertToActionsEnvironmentRef(
  context: TemplateContext,
  token: TemplateToken
): ActionsEnvironmentReference {
  const result: ActionsEnvironmentReference = {};

  if (token.isExpression) {
    return result;
  }

  if (isScalar(token)) {
    result.name = token;
    return result;
  }

  const environmentMapping = token.assertMapping("job environment");

  for (const property of environmentMapping) {
    const propertyName = property.key.assertString("job environment key");

    // Check deployment feature flag before skipping expressions,
    // so deployment: ${{ ... }} is still gated by the flag
    if (propertyName.value === "deployment") {
      const featureFlags = context.state["featureFlags"] as FeatureFlags | undefined;
      const flags = featureFlags ?? new FeatureFlags();
      if (!flags.isEnabled("allowDeploymentKeyword")) {
        context.error(property.key, `The key 'deployment' is not allowed`);
        continue;
      }
    }

    if (property.key.isExpression || property.value.isExpression) {
      continue;
    }

    switch (propertyName.value) {
      case "name":
        result.name = property.value.assertScalar("job environment name key");
        break;

      case "url":
        result.url = property.value;
        break;

      case "deployment":
        result.deployment = property.value;
        break;
    }
  }

  return result;
}
