import {data} from "@github/actions-expressions";
import {isBoolean, isNumber, isString} from "@github/actions-workflow-parser";
import {ScalarToken} from "@github/actions-workflow-parser/templates/tokens/scalar-token";
import {TokenType} from "@github/actions-workflow-parser/templates/tokens/types";

export function scalarToData(scalar: ScalarToken): data.ExpressionData {
  if (isNumber(scalar)) {
    return new data.NumberData(scalar.value);
  }

  if (isString(scalar)) {
    return new data.StringData(scalar.value);
  }

  if (isBoolean(scalar)) {
    return new data.BooleanData(scalar.value);
  }

  if (scalar.templateTokenType === TokenType.Null) {
    return new data.Null();
  }

  return new data.StringData(scalar.toDisplayString());
}
