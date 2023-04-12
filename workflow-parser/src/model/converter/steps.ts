import { TemplateContext } from "../../templates/template-context";
import { BasicExpressionToken, MappingToken, ScalarToken, StringToken, TemplateToken } from "../../templates/tokens";
import { isSequence } from "../../templates/tokens/type-guards";
import { isActionStep } from "../type-guards";
import { ActionStep, Step } from "../workflow-template";
import { handleTemplateTokenErrors } from "./handle-errors";
import { IdBuilder } from "./id-builder";

export function convertSteps(context: TemplateContext, steps: TemplateToken): Step[] {
  if (!isSequence(steps)) {
    context.error(steps, "Invalid format for steps");
    return [];
  }

  const idBuilder = new IdBuilder();

  const result: Step[] = [];
  for (const item of steps) {
    const step = handleTemplateTokenErrors(steps, context, undefined, () => convertStep(context, idBuilder, item));
    if (step) {
      result.push(step);
    }
  }

  for (const step of result) {
    if (step.id) {
      continue;
    }

    let id = "";
    if (isActionStep(step)) {
      id = createActionStepId(step);
    }

    if (!id) {
      id = "run";
    }

    idBuilder.appendSegment(`__${id}`);
    step.id = idBuilder.build();
  }

  return result;
}

function convertStep(context: TemplateContext, idBuilder: IdBuilder, step: TemplateToken): Step | undefined {
  const mapping = step.assertMapping("steps item");

  let run: ScalarToken | undefined;
  let id: StringToken | undefined;
  let name: ScalarToken | undefined;
  let uses: StringToken | undefined;
  let continueOnError: boolean | ScalarToken | undefined;
  let env: MappingToken | undefined;
  const ifCondition = new BasicExpressionToken(undefined, undefined, "success()", undefined, undefined, undefined);
  for (const item of mapping) {
    const key = item.key.assertString("steps item key");
    switch (key.value) {
      case "id":
        id = item.value.assertString("steps item id");
        if (id) {
          const error = idBuilder.tryAddKnownId(id.value);
          if (error) {
            context.error(id, error);
          }
        }
        break;
      case "name":
        name = item.value.assertScalar("steps item name");
        break;
      case "run":
        run = item.value.assertScalar("steps item run");
        break;
      case "uses":
        uses = item.value.assertString("steps item uses");
        break;
      case "env":
        env = item.value.assertMapping("step env");
        break;
      case "continue-on-error":
        if (!item.value.isExpression) {
          continueOnError = item.value.assertBoolean("steps item continue-on-error").value;
        } else {
          continueOnError = item.value.assertScalar("steps item continue-on-error");
        }
    }
  }

  if (run) {
    return {
      id: id?.value || "",
      name,
      if: ifCondition,
      "continue-on-error": continueOnError,
      env,
      run
    };
  }

  if (uses) {
    return {
      id: id?.value || "",
      name,
      if: ifCondition,
      "continue-on-error": continueOnError,
      env,
      uses
    };
  }
  context.error(step, "Expected uses or run to be defined");
}

function createActionStepId(step: ActionStep): string {
  const uses = step.uses.value;
  if (uses.startsWith("docker://")) {
    return uses.substring("docker://".length);
  }

  if (uses.startsWith("./") || uses.startsWith(".\\")) {
    return "self";
  }

  const segments = uses.split("@");
  if (segments.length != 2) {
    return "";
  }

  const pathSegments = segments[0].split(/[\\/]/).filter(s => s.length > 0);
  const gitRef = segments[1];

  if (pathSegments.length >= 2 && pathSegments[0] && pathSegments[1] && gitRef) {
    return `${pathSegments[0]}/${pathSegments[1]}`;
  }

  return "";
}
