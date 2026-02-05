import {TemplateContext} from "../../templates/template-context.js";
import {
  BasicExpressionToken,
  MappingToken,
  ScalarToken,
  StringToken,
  TemplateToken
} from "../../templates/tokens/index.js";
import {isSequence, isString} from "../../templates/tokens/type-guards.js";
import {Step, WorkflowJob} from "../workflow-template.js";
import {convertToIfCondition} from "./if-condition.js";
import {convertConcurrency} from "./concurrency.js";
import {convertToJobContainer, convertToJobServices} from "./container.js";
import {handleTemplateTokenErrors} from "./handle-errors.js";
import {IdBuilder} from "./id-builder.js";
import {convertToActionsEnvironmentRef} from "./job/environment.js";
import {convertRunsOn} from "./job/runs-on.js";
import {convertSteps} from "./steps.js";

export function convertJob(context: TemplateContext, jobKey: StringToken, token: MappingToken): WorkflowJob {
  const error = new IdBuilder().tryAddKnownId(jobKey.value);
  if (error) {
    context.error(jobKey, error);
  }

  let concurrency,
    container,
    env,
    environment,
    ifCondition,
    name,
    outputs,
    runsOn,
    services,
    strategy,
    snapshot: TemplateToken | undefined;
  let needs: StringToken[] | undefined = undefined;
  let steps: Step[] = [];
  let workflowJobRef: StringToken | undefined;
  let workflowJobInputs: MappingToken | undefined;
  let inheritSecrets = false;
  let workflowJobSecrets: MappingToken | undefined;

  for (const item of token) {
    const propertyName = item.key.assertString("job property name");
    switch (propertyName.value) {
      case "concurrency":
        handleTemplateTokenErrors(item.value, context, undefined, () => convertConcurrency(context, item.value));
        concurrency = item.value;
        break;

      case "container":
        handleTemplateTokenErrors(item.value, context, undefined, () => convertToJobContainer(context, item.value));
        container = item.value;
        break;

      case "env":
        handleTemplateTokenErrors(item.value, context, undefined, () => {
          env = item.value.assertMapping("job env");
        });
        break;

      case "environment":
        handleTemplateTokenErrors(item.value, context, undefined, () =>
          convertToActionsEnvironmentRef(context, item.value)
        );
        environment = item.value;
        break;

      case "if":
        ifCondition = convertToIfCondition(context, item.value);
        break;

      case "name":
        name = item.value.assertScalar("job name");
        break;

      case "needs": {
        needs = [];
        if (isString(item.value)) {
          const jobNeeds = item.value.assertString("job needs id");
          needs.push(jobNeeds);
        }

        if (isSequence(item.value)) {
          for (const seqItem of item.value) {
            const jobNeeds = seqItem.assertString("job needs id");
            needs.push(jobNeeds);
          }
        }
        break;
      }

      case "outputs":
        handleTemplateTokenErrors(item.value, context, undefined, () => {
          outputs = item.value.assertMapping("job outputs");
        });
        break;

      case "runs-on":
        handleTemplateTokenErrors(item.value, context, undefined, () => convertRunsOn(context, item.value));
        runsOn = item.value;
        break;

      case "services":
        handleTemplateTokenErrors(item.value, context, undefined, () => convertToJobServices(context, item.value));
        services = item.value;
        break;

      case "snapshot":
        snapshot = item.value;
        break;

      case "steps":
        steps = convertSteps(context, item.value);
        break;

      case "strategy":
        strategy = item.value;
        break;

      case "uses":
        workflowJobRef = item.value.assertString("job uses value");
        break;

      case "with":
        handleTemplateTokenErrors(item.value, context, undefined, () => {
          workflowJobInputs = item.value.assertMapping("uses-with value");
        });
        break;
      case "secrets":
        if (isString(item.value) && item.value.value === "inherit") {
          inheritSecrets = true;
        } else {
          handleTemplateTokenErrors(item.value, context, undefined, () => {
            workflowJobSecrets = item.value.assertMapping("uses-secrets value");
          });
        }
        break;
    }
  }

  if (workflowJobRef !== undefined) {
    return {
      type: "reusableWorkflowJob",
      id: jobKey,
      name: jobName(name, jobKey),
      needs: needs || [],
      if: ifCondition || new BasicExpressionToken(undefined, undefined, "success()", undefined, undefined, undefined),
      ref: workflowJobRef,
      "input-definitions": undefined,
      "input-values": workflowJobInputs,
      "secret-definitions": undefined,
      "secret-values": workflowJobSecrets,
      "inherit-secrets": inheritSecrets || undefined,
      outputs: undefined,
      concurrency,
      strategy
    };
  } else {
    return {
      type: "job",
      id: jobKey,
      name: jobName(name, jobKey),
      needs,
      if: ifCondition || new BasicExpressionToken(undefined, undefined, "success()", undefined, undefined, undefined),
      env,
      concurrency,
      environment,
      strategy,
      "runs-on": runsOn,
      container,
      services,
      outputs,
      steps,
      snapshot
    };
  }
}

function jobName(name: ScalarToken | undefined, jobKey: StringToken): ScalarToken {
  if (name === undefined) {
    return jobKey;
  }

  if (isString(name) && name.value === "") {
    return jobKey;
  }

  return name;
}
