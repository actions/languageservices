import {TemplateValidationError} from "./templates/template-validation-error.js";
import {nullTrace} from "./test-utils/null-trace.js";
import {parseWorkflow} from "./workflows/workflow-parser.js";

describe("parseWorkflow", () => {
  it("parses valid workflow", () => {
    const result = parseWorkflow(
      {
        name: "test.yaml",
        content: "on: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n    - run: echo 'hello'"
      },
      nullTrace
    );

    expect(result.context.errors.getErrors()).toHaveLength(0);
  });

  it("contains range for error", () => {
    const result = parseWorkflow(
      {
        name: "test.yaml",
        content: "on: push\njobs:\n  build:\n    steps:\n    - run: echo 'hello'"
      },
      nullTrace
    );

    expect(result.context.errors.getErrors()).toEqual([
      new TemplateValidationError("Required property is missing: runs-on", "test.yaml (Line: 4, Col: 5)", undefined, {
        start: {line: 4, column: 5},
        end: {line: 5, column: 24}
      })
    ]);
  });

  it("error range for expression is constrained to scalar node", () => {
    const result = parseWorkflow(
      {
        name: "test.yaml",
        content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - name: \${{ github.event = 12 }}
      run: echo 'hello'`
      },
      nullTrace
    );

    expect(result.context.errors.getErrors()).toEqual([
      new TemplateValidationError(
        "Unexpected symbol: '='. Located at position 14 within expression: github.event = 12",
        "test.yaml (Line: 6, Col: 13)",
        undefined,
        {
          start: {line: 6, column: 13},
          end: {line: 6, column: 37}
        }
      )
    ]);
  });

  it("tokens contain descriptions", () => {
    const result = parseWorkflow(
      {
        name: "test.yaml",
        content:
          "on: push\nname: hello\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n    - run: echo 'hello'"
      },
      nullTrace
    );

    expect(result.context.errors.getErrors()).toHaveLength(0);
    expect(result.value).not.toBeUndefined();
    const root = result.value!.assertMapping("root"); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    expect(root.description).toBe("Workflow file with strict validation");
    for (const pair of root) {
      const key = pair.key.assertString("key").value;
      switch (key) {
        case "name": {
          const nameKey = pair.key.assertString("name");
          expect(nameKey.definition).not.toBeUndefined();
          expect(nameKey.description).toContain("The name of the workflow");
          break;
        }
        case "on": {
          const onKey = pair.key.assertString("on");
          const onValue = pair.value.assertString("push");
          expect(onKey.definition).not.toBeUndefined();
          expect(onKey.description).toContain("The GitHub event that triggers the workflow.");
          expect(onValue.definition).not.toBeUndefined();
          expect(onValue.description).toBe("Runs your workflow when you push a commit or tag.");
          break;
        }
      }
    }
  });
});
