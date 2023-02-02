import {isString} from "@github/actions-workflow-parser";
import {DefinitionType} from "@github/actions-workflow-parser/templates/schema/definition-type";
import {StringDefinition} from "@github/actions-workflow-parser/templates/schema/string-definition";
import {OPEN_EXPRESSION} from "@github/actions-workflow-parser/templates/template-constants";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/index";

export function isStringExpression(token: TemplateToken): boolean {
  const isExpression =
    token.definition?.definitionType === DefinitionType.String && (token.definition as StringDefinition).isExpression;
  const containsExpression = isString(token) && token.value.indexOf(OPEN_EXPRESSION) >= 0;
  return isExpression || containsExpression;
}
