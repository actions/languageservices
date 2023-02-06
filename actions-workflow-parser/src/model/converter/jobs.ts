import {TemplateContext} from "../../templates/template-context";
import {StringToken} from "../../templates/tokens";
import {TemplateToken} from "../../templates/tokens/template-token";
import {isMapping} from "../../templates/tokens/type-guards";
import {Job} from "../workflow-template";
import {handleTemplateTokenErrors} from "./handle-errors";
import {convertJob} from "./job";

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
