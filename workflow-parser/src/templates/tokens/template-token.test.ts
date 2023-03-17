/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion */
import {nullTrace} from "../../test-utils/null-trace";
import {parseWorkflow} from "../../workflows/workflow-parser";
import {StringToken} from "./string-token";
import {TemplateToken} from "./template-token";

describe("traverse", () => {
  it("returns parent token and key", () => {
    const workflow = parseWorkflow(
      {
        name: "wf.yaml",
        content: `on: push`
      },
      nullTrace
    );

    const root = workflow.value!;
    const traverser = TemplateToken.traverse(root);

    // Root
    expect(traverser.next()!.value).toEqual([undefined, root, undefined]);

    // On
    const onResult = traverser.next().value!;
    expect(onResult[0]).toBe(root);
    expect(getValue(onResult[1])).toEqual("on");
    expect(onResult[2]).toBeUndefined();

    // Push
    const pushResult = traverser.next().value!;
    expect(pushResult[0]).toBe(root);
    expect(getValue(pushResult[1])).toEqual("push");
    expect(getValue(pushResult[2])).toEqual("on");
  });
});

function getValue(token: TemplateToken | undefined): string {
  if (token instanceof StringToken) {
    return token.value;
  }

  return "";
}
