import {convertWorkflowTemplate, parseWorkflow, WorkflowTemplate} from "@github/actions-workflow-parser";
import {ActionStep, RunStep} from "@github/actions-workflow-parser/model/workflow-template";
import {nullTrace} from "../nulltrace";
import {getPositionFromCursor} from "../test-utils/cursor-position";
import {findToken} from "../utils/find-token";
import {getWorkflowContext, WorkflowContext} from "./workflow-context";

async function testGetWorkflowContext(input: string): Promise<WorkflowContext> {
  const [textDocument, pos] = getPositionFromCursor(input);
  const result = parseWorkflow(
    {
      content: textDocument.getText(),
      name: "wf.yaml"
    },
    nullTrace
  );

  let template: WorkflowTemplate | undefined;

  if (result.value) {
    template = await convertWorkflowTemplate(result.context, result.value);
  }

  const {path} = findToken(pos, result.value);

  return getWorkflowContext(textDocument.uri, template, path);
}

describe("getWorkflowContext", () => {
  it("context for workflow", async () => {
    const context = await testGetWorkflowContext(`on: push
name: te|st
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - echo Hello`);
    expect(context.uri).not.toBe("");
    expect(context.template).not.toBeUndefined();
    expect(context.job).toBeUndefined();
    expect(context.step).toBeUndefined();
  });

  it("context for workflow job", async () => {
    const context = await testGetWorkflowContext(`on: push
jobs:
  build:
    runs-on: ubuntu-lat|est
    steps:
      - run: echo Hello`);
    expect(context.uri).not.toBe("");
    expect(context.template).not.toBeUndefined();
    expect(context.job).not.toBeUndefined();
    expect(context.step).toBeUndefined();
  });

  it("context for workflow run step", async () => {
    const context = await testGetWorkflowContext(`on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: echo |Hello
    - uses: actions/checkout@v2`);
    expect(context.uri).not.toBe("");
    expect(context.template).not.toBeUndefined();
    expect(context.job).not.toBeUndefined();

    const step = context.step as RunStep;
    expect(step).not.toBeUndefined();
    expect(step.run.toDisplayString()).toBe("echo Hello");
  });

  it("context for workflow uses step", async () => {
    const context = await testGetWorkflowContext(`on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: echo Hello
    - uses: actions/checkout@v2|`);
    expect(context.uri).not.toBe("");
    expect(context.template).not.toBeUndefined();
    expect(context.job).not.toBeUndefined();

    const step = context.step as ActionStep;
    expect(step).not.toBeUndefined();
    expect(step.uses.value).toBe("actions/checkout@v2");
  });
});
