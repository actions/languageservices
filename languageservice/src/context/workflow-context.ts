import {isMapping, isSequence, WorkflowTemplate} from "@actions/workflow-parser";
import {isJob, isReusableWorkflowJob} from "@actions/workflow-parser/model/type-guards";
import {Job, ReusableWorkflowJob, Step} from "@actions/workflow-parser/model/workflow-template";
import {MappingToken} from "@actions/workflow-parser/templates/tokens/mapping-token";
import {SequenceToken} from "@actions/workflow-parser/templates/tokens/sequence-token";
import {StringToken} from "@actions/workflow-parser/templates/tokens/string-token";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";

export interface WorkflowContext {
  uri: string;

  template: WorkflowTemplate | undefined;

  /** If the context is for a position within a regular job, this will be the job */
  job?: Job;

  /** If the context is for a position within a reusable workflow job, this will be the reusable workflow job */
  reusableWorkflowJob?: ReusableWorkflowJob;

  /** If the context is for a position within a step, this will be the step */
  step?: Step;
}

export function getWorkflowContext(
  uri: string,
  template: WorkflowTemplate | undefined,
  tokenPath: TemplateToken[]
): WorkflowContext {
  const context: WorkflowContext = {uri: uri, template};
  if (!template) {
    return context;
  }

  let stepsSequence: SequenceToken | undefined = undefined;
  let stepToken: MappingToken | undefined = undefined;

  // Iterate through the token path to find the job and step
  for (const token of tokenPath) {
    switch (token.definition?.key) {
      case "job": {
        const jobID = (token as StringToken).value;
        const job = template.jobs.find(job => job.id.value === jobID);
        if (!job) {
          break;
        }
        if (isJob(job)) {
          context.job = job;
        } else if (isReusableWorkflowJob(job)) {
          context.reusableWorkflowJob = job;
        }
        break;
      }
      case "steps": {
        if (isSequence(token)) {
          stepsSequence = token;
        }
        break;
      }
      case "regular-step":
      case "run-step": {
        if (isMapping(token)) {
          stepToken = token;
        }
        break;
      }
    }
  }

  if (context.job && isJob(context.job)) {
    context.step = findStep(context.job.steps, stepsSequence, stepToken);
  }

  return context;
}

function findStep(steps?: Step[], stepSequence?: SequenceToken, stepToken?: MappingToken): Step | undefined {
  if (!steps || !stepSequence || !stepToken) {
    return undefined;
  }

  // Steps may not define an ID, so find the step by index
  let stepIndex = -1;
  for (let i = 0; i < stepSequence.count; i++) {
    if (stepSequence.get(i) === stepToken) {
      stepIndex = i;
      break;
    }
  }

  if (stepIndex === -1 || stepIndex >= steps.length) {
    return undefined;
  }

  return steps[stepIndex];
}
