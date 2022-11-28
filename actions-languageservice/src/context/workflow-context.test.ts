import {convertWorkflowTemplate, parseWorkflow, WorkflowTemplate} from "@github/actions-workflow-parser";
import {nullTrace} from "../nulltrace";
import {getPositionFromCursor} from "../test-utils/cursor-position";
import {findToken} from "../utils/find-token";
import {getWorkflowContext, WorkflowContext} from "./workflow-context";

function testGetWorkflowContext(input: string): [context: WorkflowContext, template?: WorkflowTemplate] {
  const [textDocument, pos] = getPositionFromCursor(input);
  const result = parseWorkflow(
    "wf.yaml",
    [
      {
        content: textDocument.getText(),
        name: "wf.yaml"
      }
    ],
    nullTrace
  );

  let template: WorkflowTemplate | undefined;

  if (result.value) {
    template = convertWorkflowTemplate(result.context, result.value);
  }

  const {path} = findToken(pos, result.value);

  return [getWorkflowContext(textDocument.uri, template, path), template];
}

describe("getWorkflowContext", () => {
  it("context for workflow", () => {
    const [context, template] = testGetWorkflowContext(`on: push
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

  it("context for workflow job", () => {
    const [context, template] = testGetWorkflowContext(`on: push
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
});
