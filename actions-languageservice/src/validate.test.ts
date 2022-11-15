import {parseWorkflow} from "@github/actions-workflow-parser";
import {TemplateValidationError} from "@github/actions-workflow-parser/templates/template-validation-error";
import {nullTrace} from "./nulltrace";

describe("validation", () => {
  it("valid workflow", () => {
    const result = parseWorkflow(
      "wf.yaml",
      [
        {
          name: "wf.yaml",
          content: "on: push\njobs:\n  build:\n    runs-on: ubuntu-latest"
        }
      ],
      nullTrace
    );

    expect(result.context.errors.getErrors().length).toBe(0);
  });

  it("missing jobs key", () => {
    const result = parseWorkflow(
      "wf.yaml",
      [
        {
          name: "wf.yaml",
          content: "on: push"
        }
      ],
      nullTrace
    );

    expect(result.context.errors.getErrors().length).toBe(1);
    expect(result.context.errors.getErrors()[0]).toEqual(
      new TemplateValidationError("Required property is missing: jobs", "wf.yaml (Line: 1, Col: 1)", undefined, {
        start: [1, 1],
        end: [1, 9]
      })
    );
  });

  it("extraneous key", () => {
    const result = parseWorkflow(
      "wf.yaml",
      [
        {
          name: "wf.yaml",
          content: `on: push
unknown-key: foo
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: echo`
        }
      ],
      nullTrace
    );

    expect(result.context.errors.getErrors().length).toBe(1);
    expect(result.context.errors.getErrors()[0]).toEqual(
      new TemplateValidationError("Unexpected value 'unknown-key'", "wf.yaml (Line: 2, Col: 1)", undefined, {
        start: [2, 1],
        end: [2, 12]
      })
    );
  });
});
