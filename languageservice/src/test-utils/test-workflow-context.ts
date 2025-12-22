import {convertWorkflowTemplate, parseWorkflow, WorkflowTemplate} from "@actions/workflow-parser";
import {getWorkflowContext, WorkflowContext} from "../context/workflow-context.js";
import {nullTrace} from "../nulltrace.js";
import {findToken} from "../utils/find-token.js";
import {getPositionFromCursor} from "./cursor-position.js";
import {testFileProvider} from "./test-file-provider.js";

export async function testGetWorkflowContext(input: string): Promise<WorkflowContext> {
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
    template = await convertWorkflowTemplate(result.context, result.value, testFileProvider, {
      fetchReusableWorkflowDepth: 1
    });
  }

  const {path} = findToken(pos, result.value);

  return getWorkflowContext(textDocument.uri, template, path);
}
