import {nullTrace} from "../test-utils/null-trace";
import {parseWorkflow} from "../workflows/workflow-parser";
import {convertWorkflowTemplate, ErrorPolicy} from "./convert";

function serializeTemplate(template: unknown): unknown {
  return JSON.parse(JSON.stringify(template));
}

describe("convertWorkflowTemplate", () => {
  it("converts workflow with one job", async () => {
    const result = parseWorkflow(
      {
        name: "wf.yaml",
        content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest`
      },
      nullTrace
    );

    const template = await convertWorkflowTemplate(result.context, result.value!, undefined, {
      errorPolicy: ErrorPolicy.TryConversion
    });

    expect(serializeTemplate(template)).toEqual({
      events: {
        push: {}
      },
      jobs: [
        {
          id: "build",
          if: {
            expr: "success()",
            type: 3
          },
          name: "build",
          needs: undefined,
          outputs: undefined,
          "runs-on": "ubuntu-latest",
          steps: [],
          type: "job"
        }
      ]
    });
  });

  it("converts workflow if expressions", async () => {
    const result = parseWorkflow(
      {
        name: "wf.yaml",
        content: `on: push
jobs:
  build:
    if: \${{ true }}
    runs-on: ubuntu-latest
  deploy:
    if: true
    runs-on: ubuntu-latest`
      },
      nullTrace
    );

    const template = await convertWorkflowTemplate(result.context, result.value!, undefined, {
      errorPolicy: ErrorPolicy.TryConversion
    });

    expect(serializeTemplate(template)).toEqual({
      events: {
        push: {}
      },
      jobs: [
        {
          id: "build",
          if: {
            expr: "success()",
            type: 3
          },
          name: "build",
          "runs-on": "ubuntu-latest",
          steps: [],
          type: "job"
        },
        {
          id: "deploy",
          if: {
            expr: "success()",
            type: 3
          },
          name: "deploy",
          "runs-on": "ubuntu-latest",
          steps: [],
          type: "job"
        }
      ]
    });
  });

  it("converts workflow with empty needs", async () => {
    const result = parseWorkflow(
      {
        name: "wf.yaml",
        content: `on: push
jobs:
  build:
    needs: # comment to preserve whitespace in test
    runs-on: ubuntu-latest`
      },
      nullTrace
    );

    const template = await convertWorkflowTemplate(result.context, result.value!, undefined, {
      errorPolicy: ErrorPolicy.TryConversion
    });

    expect(serializeTemplate(template)).toEqual({
      errors: [
        {
          Message: "wf.yaml (Line: 4, Col: 12): Unexpected value ''"
        }
      ],
      events: {
        push: {}
      },
      jobs: [
        {
          id: "build",
          if: {
            expr: "success()",
            type: 3
          },
          name: "build",
          needs: [],
          outputs: undefined,
          "runs-on": "ubuntu-latest",
          steps: [],
          type: "job"
        }
      ]
    });
  });

  it("converts workflow with needs errors", async () => {
    const result = parseWorkflow(
      {
        name: "wf.yaml",
        content: `on: push
jobs:
  job1:
    needs: [unknown-job, job3]
    runs-on: ubuntu-latest
  job2:
    runs-on: ubuntu-latest
  job3:
    needs: job1
    runs-on: ubuntu-latest`
      },
      nullTrace
    );

    const template = await convertWorkflowTemplate(result.context, result.value!, undefined, {
      errorPolicy: ErrorPolicy.TryConversion
    });

    expect(serializeTemplate(template)).toEqual({
      errors: [
        {
          Message: "wf.yaml (Line: 4, Col: 13): Job 'job1' depends on unknown job 'unknown-job'."
        },
        {
          Message:
            "wf.yaml (Line: 4, Col: 26): Job 'job1' depends on job 'job3' which creates a cycle in the dependency graph."
        },
        {
          Message:
            "wf.yaml (Line: 9, Col: 12): Job 'job3' depends on job 'job1' which creates a cycle in the dependency graph."
        }
      ],
      events: {
        push: {}
      },
      jobs: [
        {
          id: "job1",
          if: {
            expr: "success()",
            type: 3
          },
          name: "job1",
          needs: ["unknown-job", "job3"],
          "runs-on": "ubuntu-latest",
          steps: [],
          type: "job"
        },
        {
          id: "job2",
          if: {
            expr: "success()",
            type: 3
          },
          name: "job2",
          "runs-on": "ubuntu-latest",
          steps: [],
          type: "job"
        },
        {
          id: "job3",
          if: {
            expr: "success()",
            type: 3
          },
          name: "job3",
          needs: ["job1"],
          "runs-on": "ubuntu-latest",
          steps: [],
          type: "job"
        }
      ]
    });
  });

  it("converts workflow with invalid on", async () => {
    const result = parseWorkflow(
      {
        name: "wf.yaml",
        content: `on:
  workflow_dispatch:
    inputs:
      test:
        options: 123
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hello`
      },
      nullTrace
    );

    const template = await convertWorkflowTemplate(result.context, result.value!, undefined, {
      errorPolicy: ErrorPolicy.TryConversion
    });

    expect(template.jobs).not.toBeUndefined();
    expect(template.jobs).toHaveLength(1);
    expect(serializeTemplate(template)).toEqual({
      errors: [
        {
          Message: "wf.yaml (Line: 5, Col: 18): Unexpected value '123'"
        },
        {
          Message:
            "wf.yaml (Line: 5, Col: 18): Unexpected type 'NumberToken' encountered while reading 'input options'. The type 'SequenceToken' was expected."
        }
      ],
      events: {},
      jobs: [
        {
          id: "build",
          if: {
            expr: "success()",
            type: 3
          },
          name: "build",
          needs: undefined,
          outputs: undefined,
          "runs-on": "ubuntu-latest",
          steps: [
            {
              id: "__run",
              if: {
                expr: "success()",
                type: 3
              },
              run: "echo hello"
            }
          ],
          type: "job"
        }
      ]
    });
  });

  it("converts workflow with invalid jobs", async () => {
    const result = parseWorkflow(
      {
        name: "wf.yaml",
        content: `on: push
jobs:
  build:`
      },
      nullTrace
    );

    const template = await convertWorkflowTemplate(result.context, result.value!, undefined, {
      errorPolicy: ErrorPolicy.TryConversion
    });

    expect(template.jobs).not.toBeUndefined();
    expect(template.jobs).toHaveLength(0);
    expect(serializeTemplate(template)).toEqual({
      errors: [
        {
          Message: "wf.yaml (Line: 3, Col: 9): Unexpected value ''"
        },
        {
          Message:
            "wf.yaml (Line: 3, Col: 9): Unexpected type 'NullToken' encountered while reading 'job build'. The type 'MappingToken' was expected."
        }
      ],
      events: {
        push: {}
      },
      jobs: []
    });
  });
});
