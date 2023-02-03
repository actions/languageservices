import {ActionStep, Job, ReusableWorkflowJob, RunStep, Step} from "./workflow-template";

export function isRunStep(step: Step): step is RunStep {
  return (step as RunStep).run !== undefined;
}

export function isActionStep(step: Step): step is ActionStep {
  return (step as ActionStep).uses !== undefined;
}

export function isJob(job: Job | ReusableWorkflowJob): job is Job {
  return job.type === "job";
}

export function isReusableWorkflowJob(job: Job | ReusableWorkflowJob): job is ReusableWorkflowJob {
  return job.type === "reusableWorkflowJob";
}
