import {isString} from "@actions/workflow-parser";
import {OPEN_EXPRESSION} from "@actions/workflow-parser/templates/template-constants";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/index";

export function isPotentiallyExpression(token: TemplateToken): boolean {
  const containsExpression = isString(token) && token.value != null && token.value.indexOf(OPEN_EXPRESSION) >= 0;
  // If conditions are always expressions (job-if, step-if, snapshot-if)
  const definitionKey = token.definition?.key;
  const isIfCondition = definitionKey === "job-if" || definitionKey === "step-if" || definitionKey === "snapshot-if";
  return containsExpression || isIfCondition;
}
