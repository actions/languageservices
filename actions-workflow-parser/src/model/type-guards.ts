import { ActionStep, RunStep, Step } from "./workflow-template"

export function isRunStep(step: Step): step is RunStep {
  return (step as RunStep).run !== undefined
}

export function isActionStep(step: Step): step is ActionStep {
  return (step as ActionStep).uses !== undefined
}
