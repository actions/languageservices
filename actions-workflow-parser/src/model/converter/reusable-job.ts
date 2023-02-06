import {TemplateContext} from "../../templates/template-context";
import {MappingToken, StringToken} from "../../templates/tokens";
import {ReusableWorkflowJob} from "../workflow-template";
import {convertBaseJob} from "./base-job";

export function convertResuableWorkflowJob(
  context: TemplateContext,
  jobKey: StringToken,
  token: MappingToken
): ReusableWorkflowJob {
  const base = convertBaseJob(context, jobKey, token);

  const result: ReusableWorkflowJob = {
    type: "reusableWorkflowJob",
    id: base.id,
    name: base.name,
    needs: base.needs,
    if: base.if,
    concurrency: base.concurrency,
    strategy: base.strategy,
    uses: new StringToken(undefined, undefined, "undefined", undefined, undefined)
  };

  for (const item of token) {
    const propertyName = item.key.assertString("job property name");
    switch (propertyName.value) {
      case "uses":
        result.uses = item.value.assertString("job item uses");
        break;
    }
  }

  return result;
}
