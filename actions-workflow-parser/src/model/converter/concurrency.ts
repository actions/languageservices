import { TemplateContext } from "../../templates/template-context"
import { TemplateToken } from "../../templates/tokens/template-token"
import { isString } from "../../templates/tokens/type-guards"
import { ConcurrencySetting } from "../workflow-template"

export function convertConcurrency(
  context: TemplateContext,
  token: TemplateToken
): ConcurrencySetting {
  const result: ConcurrencySetting = {}

  if (token.isExpression) {
    return result
  }
  if (isString(token)) {
    result.group = token
    return result
  }
  const concurrencyProperty = token.assertMapping("concurrency group")
  for (const property of concurrencyProperty) {
    const propertyName = property.key.assertString("concurrency group key")
    if (property.key.isExpression || property.value.isExpression) {
      continue
    }
    switch (propertyName.value) {
      case "group":
        result.group = property.value.assertString("concurrency group")
        break
      case "cancel-in-progress":
        result.cancelInProgress =
          property.value.assertBoolean("cancel-in-progress").value
        break
      default:
        context.error(
          propertyName,
          `Invalid property name: ${propertyName.value}`
        )
    }
  }

  return result
}
