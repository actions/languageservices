import {TemplateContext} from "../../templates/template-context";
import {StringToken, MappingToken} from "../../templates/tokens";
import {Job} from "../workflow-template";
import {convertBaseJob} from "./base-job";
import {convertToJobContainer, convertToJobServices} from "./container";
import {handleTemplateTokenErrors} from "./handle-errors";
import {convertToActionsEnvironmentRef} from "./job/environment";
import {convertRunsOn} from "./job/runs-on";
import {convertSteps} from "./steps";

export function convertJob(context: TemplateContext, jobKey: StringToken, token: MappingToken): Job {
  const base = convertBaseJob(context, jobKey, token);
  const result: Job = {
    type: "job",
    id: base.id,
    name: base.name,
    needs: base.needs,
    if: base.if,
    env: undefined,
    concurrency: base.concurrency,
    environment: undefined,
    strategy: base.strategy,
    "runs-on": undefined,
    container: undefined,
    services: undefined,
    outputs: undefined,
    steps: []
  };

  for (const item of token) {
    const propertyName = item.key.assertString("job property name");
    switch (propertyName.value) {
      case "container":
        convertToJobContainer(context, item.value);
        result.container = item.value;
        break;

      case "env":
        result.env = item.value.assertMapping("job env");
        break;

      case "environment":
        handleTemplateTokenErrors(item.value, context, undefined, () =>
          convertToActionsEnvironmentRef(context, item.value)
        );
        result.environment = item.value;
        break;

      case "outputs":
        result.outputs = item.value.assertMapping("job outputs");
        break;

      case "runs-on":
        handleTemplateTokenErrors(item.value, context, undefined, () => convertRunsOn(context, item.value));
        result["runs-on"] = item.value;
        break;

      case "services":
        convertToJobServices(context, item.value);
        result.services = item.value;
        break;

      case "steps":
        result.steps = convertSteps(context, item.value);
        break;
    }
  }

  return result;
}
