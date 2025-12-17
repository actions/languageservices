/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {DescriptionDictionary, isDescriptionDictionary} from "@actions/expressions";
import {WorkflowContext} from "../context/workflow-context.js";
import {getStepsContext} from "./steps.js";

function createWorkflowContext(stepIds: string[], currentStepId?: string): WorkflowContext {
  return {
    job: {
      steps: stepIds.map(id => ({id}))
    },
    step: currentStepId ? {id: currentStepId} : undefined
  } as WorkflowContext;
}

describe("steps context", () => {
  it("returns empty dictionary when no job", () => {
    const workflowContext = {} as WorkflowContext;
    const context = getStepsContext(workflowContext);
    expect(context.pairs().length).toBe(0);
  });

  it("returns empty dictionary when no steps", () => {
    const workflowContext = {job: {}} as WorkflowContext;
    const context = getStepsContext(workflowContext);
    expect(context.pairs().length).toBe(0);
  });

  it("includes steps with user-defined ids", () => {
    const workflowContext = createWorkflowContext(["step-a", "step-b"]);
    const context = getStepsContext(workflowContext);

    expect(context.get("step-a")).toBeDefined();
    expect(context.get("step-b")).toBeDefined();
  });

  it("excludes generated step ids (starting with __)", () => {
    const workflowContext = createWorkflowContext(["step-a", "__generated"]);
    const context = getStepsContext(workflowContext);

    expect(context.get("step-a")).toBeDefined();
    expect(context.get("__generated")).toBeUndefined();
  });

  it("excludes current step and later steps", () => {
    const workflowContext = createWorkflowContext(["step-a", "step-b", "step-c"], "step-b");
    const context = getStepsContext(workflowContext);

    expect(context.get("step-a")).toBeDefined();
    expect(context.get("step-b")).toBeUndefined();
    expect(context.get("step-c")).toBeUndefined();
  });

  describe("step outputs", () => {
    it("outputs is a dictionary, not null", () => {
      const workflowContext = createWorkflowContext(["step-a"]);
      const context = getStepsContext(workflowContext);

      const stepContext = context.get("step-a");
      expect(stepContext).toBeDefined();
      expect(isDescriptionDictionary(stepContext!)).toBe(true);

      const outputs = (stepContext as DescriptionDictionary).get("outputs");
      expect(outputs).toBeDefined();
      expect(isDescriptionDictionary(outputs!)).toBe(true);
    });

    it("outputs is marked incomplete to allow dynamic outputs", () => {
      const workflowContext = createWorkflowContext(["step-a"]);
      const context = getStepsContext(workflowContext);

      const stepContext = context.get("step-a") as DescriptionDictionary;
      const outputs = stepContext.get("outputs") as DescriptionDictionary;

      // Outputs should be incomplete since we can't know what outputs a step will produce
      expect(outputs.complete).toBe(false);
    });
  });
});
