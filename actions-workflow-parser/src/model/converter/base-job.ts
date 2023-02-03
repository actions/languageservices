import {TemplateContext} from "../../templates/template-context";
import {StringToken, MappingToken, BasicExpressionToken} from "../../templates/tokens";
import {isSequence, isString} from "../../templates/tokens/type-guards";
import {BaseJob} from "../workflow-template";
import {convertConcurrency} from "./concurrency";
import {handleTemplateTokenErrors} from "./handle-errors";
import {IdBuilder} from "./id-builder";

export function convertBaseJob(
  context: TemplateContext,
  jobKey: StringToken,
  token: MappingToken
): Omit<BaseJob, "type"> {
  const error = new IdBuilder().tryAddKnownId(jobKey.value);
  if (error) {
    context.error(jobKey, error);
  }

  const result: Omit<BaseJob, "type"> = {
    id: jobKey,
    name: undefined,
    needs: undefined,
    if: new BasicExpressionToken(undefined, undefined, "success()", undefined, undefined, undefined),
    concurrency: undefined,
    strategy: undefined
  };

  for (const item of token) {
    const propertyName = item.key.assertString("job property name");
    switch (propertyName.value) {
      case "concurrency":
        handleTemplateTokenErrors(item.value, context, undefined, () => convertConcurrency(context, item.value));
        result.concurrency = item.value;
        break;

      case "name":
        result.name = item.value.assertScalar("job name");
        break;

      case "needs":
        result.needs = [];
        if (isString(item.value)) {
          const jobNeeds = item.value.assertString("job needs id");
          result.needs.push(jobNeeds);
        }

        if (isSequence(item.value)) {
          for (const seqItem of item.value) {
            const jobNeeds = seqItem.assertString("job needs id");
            result.needs.push(jobNeeds);
          }
        }
        break;

      case "strategy":
        result.strategy = item.value;
        break;
    }
  }

  if (!result.name) {
    result.name = result.id;
  }

  return result;
}
