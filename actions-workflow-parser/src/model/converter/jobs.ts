import {TemplateContext} from "../../templates/template-context";
import {BasicExpressionToken, MappingToken, StringToken} from "../../templates/tokens";
import {TemplateToken} from "../../templates/tokens/template-token";
import {isMapping, isSequence, isString} from "../../templates/tokens/type-guards";
import {Job} from "../workflow-template";
import {convertConcurrency} from "./concurrency";
import {convertToJobContainer, convertToJobServices} from "./container";
import {handleTemplateTokenErrors} from "./handle-errors";
import {IdBuilder} from "./id-builder";
import {convertToActionsEnvironmentRef} from "./job/environment";
import {convertSteps} from "./steps";

type nodeInfo = {
  name: string;
  needs: StringToken[];
};

export function convertJobs(context: TemplateContext, token: TemplateToken): Job[] {
  if (isMapping(token)) {
    const result: Job[] = [];
    const jobsWithSatisfiedNeeds: nodeInfo[] = [];
    const alljobsWithUnsatisfiedNeeds: nodeInfo[] = [];

    for (const item of token) {
      const jobKey = item.key.assertString("job name");
      const jobDef = item.value.assertMapping(`job ${jobKey.value}`);

      const job = handleTemplateTokenErrors(token, context, undefined, () => convertJob(context, jobKey, jobDef));
      if (job) {
        result.push(job);
        const node = {
          name: job.id.value,
          needs: Object.assign([], job.needs)
        };
        if (node.needs.length > 0) {
          alljobsWithUnsatisfiedNeeds.push(node);
        } else {
          jobsWithSatisfiedNeeds.push(node);
        }
      }
    }

    //validate job needs
    validateNeeds(token, context, result, jobsWithSatisfiedNeeds, alljobsWithUnsatisfiedNeeds);

    return result;
  }

  context.error(token, "Invalid format for jobs");
  return [];
}

function validateNeeds(
  token: TemplateToken,
  context: TemplateContext,
  result: Job[],
  jobsWithSatisfiedNeeds: nodeInfo[],
  alljobsWithUnsatisfiedNeeds: nodeInfo[]
) {
  if (jobsWithSatisfiedNeeds.length == 0) {
    context.error(token, "The workflow must contain at least one job with no dependencies.");
    return;
  }

  // Figure out which nodes would start after current completes
  while (jobsWithSatisfiedNeeds.length > 0) {
    const currentJob = jobsWithSatisfiedNeeds.shift();
    if (currentJob == undefined) {
      break;
    }
    for (let i = alljobsWithUnsatisfiedNeeds.length - 1; i >= 0; i--) {
      const unsatisfiedJob = alljobsWithUnsatisfiedNeeds[i];
      for (let j = unsatisfiedJob.needs.length - 1; j >= 0; j--) {
        const need = unsatisfiedJob.needs[j];
        if (need.value == currentJob.name) {
          unsatisfiedJob.needs.splice(j, 1);
          if (unsatisfiedJob.needs.length == 0) {
            jobsWithSatisfiedNeeds.push(unsatisfiedJob);
            alljobsWithUnsatisfiedNeeds.splice(i, 1);
          }
        }
      }
    }
  }

  // Check whether some jobs will never execute
  if (alljobsWithUnsatisfiedNeeds.length > 0) {
    const jobNames = result.map(x => x.id.value);
    for (const unsatisfiedJob of alljobsWithUnsatisfiedNeeds) {
      for (const need of unsatisfiedJob.needs) {
        if (jobNames.includes(need.value)) {
          context.error(
            need,
            `Job '${unsatisfiedJob.name}' depends on job '${need.value}' which creates a cycle in the dependency graph.`
          );
        } else {
          context.error(need, `Job '${unsatisfiedJob.name}' depends on unknown job '${need.value}'.`);
        }
      }
    }
  }
}

function convertJob(context: TemplateContext, jobKey: StringToken, token: MappingToken): Job {
  const error = new IdBuilder().tryAddKnownId(jobKey.value);
  if (error) {
    context.error(jobKey, error);
  }
  const result: Job = {
    type: "job",
    id: jobKey,
    name: undefined,
    needs: undefined,
    if: new BasicExpressionToken(undefined, undefined, "success()", undefined, undefined, undefined),
    env: undefined,
    concurrency: undefined,
    environment: undefined,
    strategy: undefined,
    "runs-on": undefined,
    container: undefined,
    services: undefined,
    outputs: undefined,
    steps: []
  };

  for (const item of token) {
    const propertyName = item.key.assertString("job property name");
    switch (propertyName.value) {
      case "concurrency":
        handleTemplateTokenErrors(item.value, context, undefined, () => convertConcurrency(context, item.value));
        result.concurrency = item.value;
        break;

      case "container":
        // Do early validation, but don't convert
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

      case "outputs":
        result.outputs = item.value.assertMapping("job outputs");
        break;

      case "runs-on":
        handleTemplateTokenErrors(item.value, context, undefined, () => convertRunsOn(context, item.value));
        result["runs-on"] = item.value;
        break;

      case "services":
        // Do early validation, but don't convert
        convertToJobServices(context, item.value);
        result.services = item.value;
        break;

      case "steps":
        result.steps = convertSteps(context, item.value);
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

type RunsOn = {
  labels: Set<string>;
  group: string;
};

function convertRunsOn(context: TemplateContext, token: TemplateToken): RunsOn {
  const labels = convertRunsOnLabels(token);

  if (!isMapping(token)) {
    return {
      labels,
      group: ""
    };
  }

  let group = "";

  for (const item of token) {
    const key = item.key.assertString("job runs-on property name");
    switch (key.value) {
      case "group": {
        if (item.value.isExpression) {
          continue;
        }

        const groupName = item.value.assertString("job runs-on group name").value;
        const names = groupName.split("/");
        switch (names.length) {
          case 1: {
            group = groupName;
            break;
          }
          case 2: {
            if (!["org", "organization", "ent", "enterprise"].includes(names[0])) {
              context.error(
                item.value,
                `Invalid runs-on group name '${groupName}. Please use 'organization/' or 'enterprise/' prefix to target a single runner group.'`
              );
              continue;
            }
            if (!names[1]) {
              context.error(item.value, `Invalid runs-on group name '${groupName}'.`);
              continue;
            }

            group = groupName;
            break;
          }
          default: {
            context.error(
              item.value,
              `Invalid runs-on group name '${groupName}. Please use 'organization/' or 'enterprise/' prefix to target a single runner group.'`
            );
            break;
          }
        }
        break;
      }
      case "labels": {
        const mapLabels = convertRunsOnLabels(item.value);
        for (const label of mapLabels) {
          labels.add(label);
        }
        break;
      }
    }
  }

  return {
    labels,
    group
  };
}

function convertRunsOnLabels(token: TemplateToken): Set<string> {
  const labels = new Set<string>();
  if (token.isExpression) {
    return labels;
  }

  if (isString(token)) {
    labels.add(token.value);
    return labels;
  }

  if (isSequence(token)) {
    for (const item of token) {
      if (item.isExpression) {
        continue;
      }

      const label = item.assertString("job runs-on label sequence item");
      labels.add(label.value);
    }
  }

  return labels;
}
