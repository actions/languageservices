import {TemplateContext} from "../../templates/template-context.js";
import {
  BasicExpressionToken,
  MappingToken,
  NullToken,
  ScalarToken,
  StringToken,
  TemplateToken
} from "../../templates/tokens/index.js";
import {isSequence} from "../../templates/tokens/type-guards.js";
import {isActionStep} from "../type-guards.js";
import {convertToIfCondition} from "./if-condition.js";
import {ActionStep, Step} from "../workflow-template.js";
import {handleTemplateTokenErrors} from "./handle-errors.js";
import {IdBuilder} from "./id-builder.js";
import {FeatureFlags} from "@actions/expressions/features";

export function convertSteps(context: TemplateContext, steps: TemplateToken): Step[] {
  if (!isSequence(steps)) {
    context.error(steps, "Invalid format for steps");
    return [];
  }

  const idBuilder = new IdBuilder();
  const knownStepIds = new Set<string>();

  const result: Step[] = [];
  for (const item of steps) {
    const step = handleTemplateTokenErrors(steps, context, undefined, () =>
      convertStep(context, idBuilder, knownStepIds, item)
    );
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
    } else if ("wait" in step) {
      id = "wait";
    } else if ("wait-all" in step) {
      id = "wait-all";
    } else if ("cancel" in step) {
      id = "cancel";
    }

    if (!id) {
      id = "run";
    }

    idBuilder.appendSegment(`__${id}`);
    step.id = idBuilder.build();
  }

  return result;
}

function convertStep(
  context: TemplateContext,
  idBuilder: IdBuilder,
  knownStepIds: Set<string>,
  step: TemplateToken
): Step | undefined {
  const mapping = step.assertMapping("steps item");

  let run: ScalarToken | undefined;
  let id: StringToken | undefined;
  let name: ScalarToken | undefined;
  let uses: StringToken | undefined;
  let background: boolean | undefined;
  let wait: StringToken[] | undefined;
  let waitAll: boolean | undefined;
  let cancel: StringToken | undefined;
  let continueOnError: boolean | ScalarToken | undefined;
  let env: MappingToken | undefined;
  let ifCondition: BasicExpressionToken | undefined;
  for (const item of mapping) {
    const key = item.key.assertString("steps item key");
    switch (key.value) {
      case "id":
        id = item.value.assertString("steps item id");
        if (id) {
          const error = idBuilder.tryAddKnownId(id.value);
          if (error) {
            context.error(id, error);
          } else {
            knownStepIds.add(id.value);
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
      case "background":
        background = item.value.assertBoolean("steps item background").value;
        break;
      case "wait":
        wait = convertWaitTargets(context, knownStepIds, item.value, id);
        break;
      case "wait-all":
        waitAll = convertWaitAllValue(context, item.value);
        break;
      case "cancel":
        cancel = item.value.assertString("steps item cancel");
        validateTargetStepId(context, knownStepIds, cancel, id);
        break;
      case "env":
        env = item.value.assertMapping("step env");
        break;
      case "if":
        ifCondition = convertToIfCondition(context, item.value);
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
      if: ifCondition || new BasicExpressionToken(undefined, undefined, "success()", undefined, undefined, undefined),
      "continue-on-error": continueOnError,
      env,
      run,
      background
    };
  }

  if (uses) {
    return {
      id: id?.value || "",
      name,
      if: ifCondition || new BasicExpressionToken(undefined, undefined, "success()", undefined, undefined, undefined),
      "continue-on-error": continueOnError,
      env,
      uses,
      background
    };
  }

  if (wait) {
    return {
      id: id?.value || "",
      name: name || createSyntheticStepName("Wait"),
      "continue-on-error": continueOnError,
      wait
    };
  }

  if (waitAll !== undefined) {
    return {
      id: id?.value || "",
      name: name || createSyntheticStepName("Wait for all"),
      "continue-on-error": continueOnError,
      "wait-all": waitAll
    };
  }

  if (cancel) {
    return {
      id: id?.value || "",
      name: name || createSyntheticStepName("Cancel"),
      "continue-on-error": continueOnError,
      cancel
    };
  }
  context.error(
    step,
    (context.state.featureFlags as FeatureFlags | undefined)?.isEnabled("allowBackgroundSteps")
      ? "Expected one of uses, run, wait, wait-all, or cancel to be defined"
      : "Expected one of uses or run to be defined"
  );
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

function createSyntheticStepName(value: string): ScalarToken {
  return new StringToken(undefined, undefined, value, undefined, undefined, undefined);
}

function convertWaitTargets(
  context: TemplateContext,
  knownStepIds: Set<string>,
  token: TemplateToken,
  ownStepId?: StringToken
): StringToken[] {
  if (token instanceof StringToken) {
    validateTargetStepId(context, knownStepIds, token, ownStepId);
    return [token];
  }

  const sequence = token.assertSequence("steps item wait");
  const targets: StringToken[] = [];
  for (let i = 0; i < sequence.count; i++) {
    const target = sequence.get(i).assertString("steps item wait item");
    validateTargetStepId(context, knownStepIds, target, ownStepId);
    targets.push(target);
  }

  return targets;
}

function convertWaitAllValue(context: TemplateContext, token: TemplateToken): boolean {
  if (token instanceof NullToken) {
    return true;
  }

  const value = token.assertBoolean("steps item wait-all").value;
  if (!value) {
    context.error(token, "The value of 'wait-all' must be true or omitted");
  }

  return true;
}

function validateTargetStepId(
  context: TemplateContext,
  knownStepIds: Set<string>,
  target: StringToken,
  ownStepId?: StringToken
) {
  if (target.value.startsWith("__")) {
    context.error(target, `The identifier '${target.value}' is invalid. IDs starting with '__' are reserved.`);
  } else if (ownStepId && target.value.toLowerCase() === ownStepId.value.toLowerCase()) {
    context.error(target, `Step '${ownStepId.value}' cannot reference itself`);
  } else if (!knownStepIds.has(target.value)) {
    context.error(target, `Step references unknown step ID '${target.value}'`);
  }
}
