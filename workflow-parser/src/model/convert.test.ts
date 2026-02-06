/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {nullTrace} from "../test-utils/null-trace.js";
import {parseWorkflow} from "../workflows/workflow-parser.js";
import {convertWorkflowTemplate, ErrorPolicy} from "./convert.js";

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
    runs-on: ubuntu-latest
    steps: []`
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
    steps: []
  deploy:
    if: true
    runs-on: ubuntu-latest
    steps: []`
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
            expr: "success() && (true)",
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
            expr: "success() && (true)",
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
    runs-on: ubuntu-latest
    steps: []`
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
    steps:
      - run: echo job1
  job2:
    runs-on: ubuntu-latest
    steps:
      - run: echo job2
  job3:
    needs: job1
    runs-on: ubuntu-latest
    steps:
      - run: echo job3`
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
            "wf.yaml (Line: 13, Col: 12): Job 'job3' depends on job 'job1' which creates a cycle in the dependency graph."
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
          steps: [
            {
              id: "__run",
              if: {
                expr: "success()",
                type: 3
              },
              run: "echo job1"
            }
          ],
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
          steps: [
            {
              id: "__run",
              if: {
                expr: "success()",
                type: 3
              },
              run: "echo job2"
            }
          ],
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
          steps: [
            {
              id: "__run",
              if: {
                expr: "success()",
                type: 3
              },
              run: "echo job3"
            }
          ],
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

  it("converts workflow with one job without steps", async () => {
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
      errors: [
        {
          Message: "wf.yaml (Line: 4, Col: 5): Required property is missing: steps"
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
          needs: undefined,
          outputs: undefined,
          "runs-on": "ubuntu-latest",
          steps: [],
          type: "job"
        }
      ]
    });
  });

  // Extra coverage since workflow_call components are not all covered by x-lang parsers
  it("converts workflow_call on", async () => {
    const result = parseWorkflow(
      {
        name: "wf.yaml",
        content: `on:
  workflow_call:
    inputs:
      test:
        type: string
        description: 'a test'
        required: true
        default: 'testing 123'
    secrets:
      secret1:
        description: 'first secret'
        required: true
      secret2:
jobs:
  build:
    runs-on: ubuntu-latest
    steps: []`
      },
      nullTrace
    );

    const template = await convertWorkflowTemplate(result.context, result.value!, undefined, {
      errorPolicy: ErrorPolicy.TryConversion
    });

    expect(serializeTemplate(template)).toEqual({
      events: {
        workflow_call: {
          inputs: {
            test: {
              description: "a test",
              required: true,
              type: "string",
              default: "testing 123"
            }
          },
          secrets: {
            secret1: {
              description: "first secret",
              required: true
            },
            secret2: {}
          }
        }
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

  describe("if condition context validation", () => {
    it("validates job-level if with allowed contexts", async () => {
      const result = parseWorkflow(
        {
          name: "wf.yaml",
          content: `on: push
jobs:
  build:
    if: github.event_name == 'push' && needs.test.result == 'success'
    needs: test
    runs-on: ubuntu-latest
  test:
    runs-on: ubuntu-latest`
        },
        nullTrace
      );

      const template = await convertWorkflowTemplate(result.context, result.value!, undefined, {
        errorPolicy: ErrorPolicy.TryConversion
      });

      // Should convert successfully - github and needs are allowed in job-level if
      expect(result.context.errors.getErrors()).toHaveLength(0);
      expect(template.jobs).toHaveLength(2);
    });

    it("validates job-level if rejects disallowed contexts", async () => {
      const result = parseWorkflow(
        {
          name: "wf.yaml",
          content: `on: push
jobs:
  build:
    if: steps.test.outcome == 'success'
    runs-on: ubuntu-latest
    steps:
      - id: test
        run: echo hello`
        },
        nullTrace
      );

      await convertWorkflowTemplate(result.context, result.value!, undefined, {
        errorPolicy: ErrorPolicy.TryConversion
      });

      // Should have error - steps context not allowed in job-level if
      const errors = result.context.errors.getErrors();
      expect(errors.length).toBeGreaterThan(0);
      const errorMessages = errors.map(e => e.message).join(" ");
      expect(errorMessages.toLowerCase()).toMatch(/steps|context/);
    });

    it("validates step-level if allows all contexts", async () => {
      const result = parseWorkflow(
        {
          name: "wf.yaml",
          content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - id: first
        run: echo hello
      - if: steps.first.outcome == 'success' && job.status == 'success'
        run: echo world`
        },
        nullTrace
      );

      const template = await convertWorkflowTemplate(result.context, result.value!, undefined, {
        errorPolicy: ErrorPolicy.TryConversion
      });

      // Should convert successfully - steps and job contexts allowed in step-level if
      expect(result.context.errors.getErrors()).toHaveLength(0);
      expect(template.jobs).toHaveLength(1);
    });

    it("handles case-insensitive status functions in if conditions", async () => {
      const result = parseWorkflow(
        {
          name: "wf.yaml",
          content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - if: Success()
        run: echo "uppercase Success"
      - if: FAILURE()
        run: echo "uppercase FAILURE"
      - if: Cancelled() || Always()
        run: echo "mixed case"`
        },
        nullTrace
      );

      const template = await convertWorkflowTemplate(result.context, result.value!, undefined, {
        errorPolicy: ErrorPolicy.TryConversion
      });

      // Should convert successfully - status functions are case-insensitive
      expect(result.context.errors.getErrors()).toHaveLength(0);
      expect(template.jobs).toHaveLength(1);

      // Verify the conditions are preserved without wrapping in success() &&
      const job = template.jobs[0];
      expect(job.type).toBe("job");
      if (job.type === "job") {
        expect(job.steps[0].if?.expression).toBe("Success()");
        expect(job.steps[1].if?.expression).toBe("FAILURE()");
        expect(job.steps[2].if?.expression).toBe("Cancelled() || Always()");
      }
    });

    it("handles empty if condition", async () => {
      const result = parseWorkflow(
        {
          name: "wf.yaml",
          content: `on: push
jobs:
  job1:
    if: ""
    runs-on: ubuntu-latest
    steps:
      - run: echo hello
  job2:
    if: ''
    runs-on: ubuntu-latest
    steps:
      - if: ""
        run: echo world
      - if: ''
        run: echo test`
        },
        nullTrace
      );

      const template = await convertWorkflowTemplate(result.context, result.value!, undefined, {
        errorPolicy: ErrorPolicy.TryConversion
      });

      // Empty conditions should default to success()
      expect(result.context.errors.getErrors()).toHaveLength(0);
      expect(template.jobs).toHaveLength(2);

      const job1 = template.jobs[0];
      expect(job1.if?.expression).toBe("success()");

      const job2 = template.jobs[1];
      expect(job2.if?.expression).toBe("success()");

      if (job2.type === "job") {
        expect(job2.steps[0].if?.expression).toBe("success()");
        expect(job2.steps[1].if?.expression).toBe("success()");
      }
    });

    it("handles status functions with property access", async () => {
      const result = parseWorkflow(
        {
          name: "wf.yaml",
          content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - if: success().outputs.result
        run: echo "success with property"
      - if: failure().outputs.value
        run: echo "failure with property"
      - if: always() && steps.test.outcome
        run: echo "always with &&"`
        },
        nullTrace
      );

      const template = await convertWorkflowTemplate(result.context, result.value!, undefined, {
        errorPolicy: ErrorPolicy.TryConversion
      });

      // Should not wrap - status functions are present even with property access
      expect(result.context.errors.getErrors()).toHaveLength(0);
      expect(template.jobs).toHaveLength(1);

      const job = template.jobs[0];
      expect(job.type).toBe("job");
      if (job.type === "job") {
        expect(job.steps[0].if?.expression).toBe("success().outputs.result");
        expect(job.steps[1].if?.expression).toBe("failure().outputs.value");
        expect(job.steps[2].if?.expression).toBe("always() && steps.test.outcome");
      }
    });
  });
});
