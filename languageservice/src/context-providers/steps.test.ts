/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {DescriptionDictionary, isDescriptionDictionary} from "@actions/expressions";
import {ExpressionData} from "@actions/expressions/data/expressiondata";
import {WorkflowContext} from "../context/workflow-context.js";
import {getStepsContext} from "./steps.js";
import {ParallelStep, Step} from "@actions/workflow-parser/model/workflow-template";
import {StringToken} from "@actions/workflow-parser/templates/tokens/string-token";

function createWorkflowContext(steps: Partial<Step>[], currentStepId?: string): WorkflowContext {
  return {
    job: {
      steps
    },
    step: currentStepId ? {id: currentStepId} : undefined
  } as WorkflowContext;
}

function parallel(...steps: Partial<Step>[]): ParallelStep {
  return {parallel: steps} as ParallelStep;
}

function waitFor(...stepIds: string[]): StringToken[] {
  return stepIds.map(id => new StringToken(undefined, undefined, id, undefined));
}

function expectSteps(context: DescriptionDictionary, ...stepIds: string[]): void {
  expect(context.pairs().sort((a, b) => a.key.localeCompare(b.key))).toEqual(
    stepIds.map(id => ({key: id, value: expect.anything() as ExpressionData}))
  );
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
    const workflowContext = createWorkflowContext([{id: "step-a"}, {id: "step-b"}]);
    const context = getStepsContext(workflowContext);

    expectSteps(context, "step-a", "step-b");
  });

  it("excludes generated step ids (starting with __)", () => {
    const workflowContext = createWorkflowContext([{id: "step-a"}, {id: "__generated"}]);
    const context = getStepsContext(workflowContext);

    expectSteps(context, "step-a");
  });

  it("excludes current step and later steps", () => {
    const workflowContext = createWorkflowContext([{id: "step-a"}, {id: "step-b"}, {id: "step-c"}], "step-b");
    const context = getStepsContext(workflowContext);

    expectSteps(context, "step-a");
  });

  it("includes parallel steps when there is no current step", () => {
    const workflowContext = createWorkflowContext(
      [{id: "step-a"}, parallel({id: "step-b"}, {id: "step-c"}), {id: "step-d"}],
      undefined
    );
    const context = getStepsContext(workflowContext);

    expectSteps(context, "step-a", "step-b", "step-c", "step-d");
  });

  it("excludes generated step ids from parallel steps", () => {
    const workflowContext = createWorkflowContext(
      [{id: "step-a"}, parallel({id: "step-b"}, {id: "__generated"}, {id: "step-c"}), {id: "step-d"}],
      undefined
    );
    const context = getStepsContext(workflowContext);

    expectSteps(context, "step-a", "step-b", "step-c", "step-d");
  });

  it("includes parallel steps when the current step is after the parallel block", () => {
    const workflowContext = createWorkflowContext(
      [{id: "step-a"}, parallel({id: "step-b"}, {id: "step-c"}), {id: "step-d"}, {id: "step-e"}],
      "step-e"
    );
    const context = getStepsContext(workflowContext);

    expectSteps(context, "step-a", "step-b", "step-c", "step-d");
  });

  it("excludes parallel steps when the current step is in the parallel block", () => {
    const workflowContext = createWorkflowContext(
      [{id: "step-a"}, parallel({id: "step-b"}, {id: "step-c"}), {id: "step-d"}, {id: "step-e"}],
      "step-c"
    );
    const context = getStepsContext(workflowContext);

    expectSteps(context, "step-a");
  });

  it("includes background steps when there is no current step", () => {
    const workflowContext = createWorkflowContext(
      [
        {id: "step-a"},
        {id: "step-b", background: true},
        {id: "step-c", background: false},
        {id: "step-d", background: true},
        {id: "step-e"}
      ],
      undefined
    );
    const context = getStepsContext(workflowContext);

    expectSteps(context, "step-a", "step-b", "step-c", "step-d", "step-e");
  });

  it("includes background steps when the current step is after wait-all", () => {
    const workflowContext = createWorkflowContext(
      [
        {id: "step-a"},
        {id: "step-b", background: true},
        {id: "step-c", background: false},
        {id: "step-d", background: true},
        {"wait-all": true},
        {id: "step-e"}
      ],
      "step-e"
    );
    const context = getStepsContext(workflowContext);

    expectSteps(context, "step-a", "step-b", "step-c", "step-d");
  });

  it("includes background step when the current step is after wait for that background job", () => {
    const workflowContext = createWorkflowContext(
      [
        {id: "step-a"},
        {id: "step-b", background: true},
        {id: "step-c", background: true},
        {id: "step-d", background: false},
        {id: "step-e", background: true},
        {wait: waitFor("step-b", "step-c")},
        {id: "step-f"}
      ],
      "step-f"
    );
    const context = getStepsContext(workflowContext);

    expectSteps(context, "step-a", "step-b", "step-c", "step-d");
  });

  it("excludes background steps when the current step is before wait-all", () => {
    const workflowContext = createWorkflowContext(
      [
        {id: "step-a"},
        {id: "step-b", background: true},
        {id: "step-c", background: false},
        {id: "step-d", background: true},
        {id: "step-e"},
        {"wait-all": true},
        {id: "step-f"}
      ],
      "step-e"
    );
    const context = getStepsContext(workflowContext);

    expectSteps(context, "step-a", "step-c");
  });

  it("excludes background step when the current step is before wait for that background job", () => {
    const workflowContext = createWorkflowContext(
      [
        {id: "step-a"},
        {id: "step-b", background: true},
        {id: "step-c", background: false},
        {id: "step-d", background: true},
        {id: "step-e"},
        {wait: waitFor("step-b")},
        {id: "step-f"}
      ],
      "step-e"
    );
    const context = getStepsContext(workflowContext);

    expectSteps(context, "step-a", "step-c");
  });

  describe("step outputs", () => {
    it("outputs is a dictionary, not null", () => {
      const workflowContext = createWorkflowContext([{id: "step-a"}]);
      const context = getStepsContext(workflowContext);

      const stepContext = context.get("step-a");
      expect(stepContext).toBeDefined();
      expect(isDescriptionDictionary(stepContext!)).toBe(true);

      const outputs = (stepContext as DescriptionDictionary).get("outputs");
      expect(outputs).toBeDefined();
      expect(isDescriptionDictionary(outputs!)).toBe(true);
    });

    it("outputs is marked incomplete to allow dynamic outputs", () => {
      const workflowContext = createWorkflowContext([{id: "step-a"}]);
      const context = getStepsContext(workflowContext);

      const stepContext = context.get("step-a") as DescriptionDictionary;
      const outputs = stepContext.get("outputs") as DescriptionDictionary;

      // Outputs should be incomplete since we can't know what outputs a step will produce
      expect(outputs.complete).toBe(false);
    });
  });
});
