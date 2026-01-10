/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {StringToken} from "./templates/tokens/index.js";
import {isBasicExpression, isString} from "./templates/tokens/type-guards.js";
import {nullTrace} from "./test-utils/null-trace.js";
import {parseWorkflow} from "./workflows/workflow-parser.js";

describe("Workflow Expression Parsing", () => {
  it("preserves original expressions when building format", () => {
    const result = parseWorkflow(
      {
        name: "test.yaml",
        content: `on: push
run-name: Test \${{ github.event_name }} \${{ github.ref }}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo 'hello'`
      },
      nullTrace
    );

    expect(result.context.errors.getErrors()).toHaveLength(0);

    const run = result.value!.assertMapping("run")!;
    const runNameMapping = run.get(1)!;
    expect(runNameMapping?.key?.assertString("run-name key").value).toBe("run-name");

    const v = runNameMapping.value;
    expect(v).not.toBeUndefined();

    if (!isBasicExpression(v)) {
      throw new Error("expected run-name to be a basic expression");
    }

    expect(v.originalExpressions).toHaveLength(2);
    expect(v.originalExpressions!.map(x => x.toDisplayString())).toEqual([
      "${{ github.event_name }}",
      "${{ github.ref }}"
    ]);
  });

  it("preserves original expressions when building format for multi-line strings", () => {
    const result = parseWorkflow(
      {
        name: "test.yaml",
        content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo \${{ github.event_name }}
          echo 'hello' \${{github.ref }}`
      },
      nullTrace
    );

    expect(result.context.errors.getErrors()).toHaveLength(0);

    const run = result.value!.assertMapping("run")!;
    const jobsMapping = run.get(1)!;
    expect(jobsMapping?.key?.assertString("jobs").value).toBe("jobs");

    const job = jobsMapping.value.assertMapping("jobs").get(0).value.assertMapping("job");
    const stepRun = job
      .get(1)
      .value.assertSequence("steps")
      .get(0)
      .assertMapping("step")
      .get(0)
      .value.assertScalar("step-run");

    if (!isBasicExpression(stepRun)) {
      throw new Error("expected run-name to be a basic expression");
    }

    expect(stepRun.originalExpressions).toHaveLength(2);
    expect(stepRun.originalExpressions!.map(x => [x.toDisplayString(), x.range, x.expressionRange])).toEqual([
      [
        "${{ github.event_name }}",
        {
          start: {line: 7, column: 16},
          end: {line: 7, column: 40}
        },
        {
          start: {line: 7, column: 20},
          end: {line: 7, column: 37}
        }
      ],
      [
        "${{ github.ref }}",
        {
          start: {line: 8, column: 24},
          end: {line: 8, column: 40}
        },
        {
          start: {line: 8, column: 27},
          end: {line: 8, column: 37}
        }
      ]
    ]);
  });

  it("return errors and string token with preserved expressions for (multiple) expression errors", () => {
    const result = parseWorkflow(
      {
        name: "test.yaml",
        content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo \${{ abc }}
          echo 'hello' \${{ gith }}`
      },
      nullTrace
    );

    expect(result.context.errors.getErrors()).toHaveLength(2);

    const run = result.value!.assertMapping("run")!;
    const jobsMapping = run.get(1)!;
    expect(jobsMapping?.key?.assertString("jobs").value).toBe("jobs");

    const job = jobsMapping.value.assertMapping("jobs").get(0).value.assertMapping("job");
    const stepRun = job
      .get(1)
      .value.assertSequence("steps")
      .get(0)
      .assertMapping("step")
      .get(0)
      .value.assertScalar("step-run");

    expect(isString(stepRun)).toBe(true);
    expect((stepRun as StringToken).value).toContain("${{");
  });

  it("reports all errors for multi-line expressions at the correct locations", () => {
    const result = parseWorkflow(
      {
        name: "test.yaml",
        content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo \${{ fromJSON2('test') }}
          echo 'hello' \${{ toJSON2(inputs.test) }}`
      },
      nullTrace
    );

    expect(result.context.errors.getErrors()).toEqual([
      {
        prefix: "test.yaml (Line: 6, Col: 14)",
        range: {
          start: {line: 7, column: 16},
          end: {line: 7, column: 40}
        },
        rawMessage: "Unrecognized function: 'fromJSON2'"
      },
      {
        prefix: "test.yaml (Line: 6, Col: 14)",
        range: {
          start: {line: 8, column: 24},
          end: {line: 8, column: 51}
        },
        rawMessage: "Unrecognized function: 'toJSON2'"
      }
    ]);
  });

  it("parses isExpression strings into expression tokens", () => {
    const result = parseWorkflow(
      {
        name: "test.yaml",
        content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    steps:
      - run: echo 'hello'`
      },
      nullTrace
    );

    expect(result.context.errors.getErrors()).toHaveLength(0);

    const workflowRoot = result.value!.assertMapping("root")!;
    const jobs = workflowRoot.get(1).value.assertMapping("jobs");
    const build = jobs.get(0).value.assertMapping("job");
    const ifToken = build.get(1).value;
    // Without isExpression: true, the value is kept as a string until convertToIfCondition processes it
    expect(ifToken.toString()).toEqual("github.event_name == 'push'");

    if (!isString(ifToken)) {
      throw new Error("expected if to be a string (will be converted to expression later)");
    }
  });

  describe("Block scalar chomp style preservation", () => {
    it("preserves clip chomping (|) for literal block scalar", () => {
      const result = parseWorkflow(
        {
          name: "test.yaml",
          content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      TEST: |
        \${{ github.event_name }}
    steps:
      - run: echo hi`
        },
        nullTrace
      );

      expect(result.context.errors.getErrors()).toHaveLength(0);

      const workflowRoot = result.value!.assertMapping("root")!;
      const jobs = workflowRoot.get(1).value.assertMapping("jobs");
      const build = jobs.get(0).value.assertMapping("job");
      const env = build.get(1).value.assertMapping("env");
      const testToken = env.get(0).value;

      if (!isBasicExpression(testToken)) {
        throw new Error("expected TEST to be a basic expression");
      }

      expect(testToken.blockScalarHeader).toBe("|");
    });

    it("preserves strip chomping (|-) for literal block scalar", () => {
      const result = parseWorkflow(
        {
          name: "test.yaml",
          content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      TEST: |-
        \${{ github.event_name }}
    steps:
      - run: echo hi`
        },
        nullTrace
      );

      expect(result.context.errors.getErrors()).toHaveLength(0);

      const workflowRoot = result.value!.assertMapping("root")!;
      const jobs = workflowRoot.get(1).value.assertMapping("jobs");
      const build = jobs.get(0).value.assertMapping("job");
      const env = build.get(1).value.assertMapping("env");
      const testToken = env.get(0).value;

      if (!isBasicExpression(testToken)) {
        throw new Error("expected TEST to be a basic expression");
      }

      expect(testToken.blockScalarHeader).toBe("|-");
    });

    it("preserves keep chomping (|+) for literal block scalar", () => {
      const result = parseWorkflow(
        {
          name: "test.yaml",
          content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      TEST: |+
        \${{ github.event_name }}
    steps:
      - run: echo hi`
        },
        nullTrace
      );

      expect(result.context.errors.getErrors()).toHaveLength(0);

      const workflowRoot = result.value!.assertMapping("root")!;
      const jobs = workflowRoot.get(1).value.assertMapping("jobs");
      const build = jobs.get(0).value.assertMapping("job");
      const env = build.get(1).value.assertMapping("env");
      const testToken = env.get(0).value;

      if (!isBasicExpression(testToken)) {
        throw new Error("expected TEST to be a basic expression");
      }

      expect(testToken.blockScalarHeader).toBe("|+");
    });

    it("preserves folded clip (>) chomping", () => {
      const result = parseWorkflow(
        {
          name: "test.yaml",
          content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      TEST: >
        \${{ github.event_name }}
    steps:
      - run: echo hi`
        },
        nullTrace
      );

      expect(result.context.errors.getErrors()).toHaveLength(0);

      const workflowRoot = result.value!.assertMapping("root")!;
      const jobs = workflowRoot.get(1).value.assertMapping("jobs");
      const build = jobs.get(0).value.assertMapping("job");
      const env = build.get(1).value.assertMapping("env");
      const testToken = env.get(0).value;

      if (!isBasicExpression(testToken)) {
        throw new Error("expected TEST to be a basic expression");
      }

      expect(testToken.blockScalarHeader).toBe(">");
    });

    it("preserves folded strip (>-) chomping", () => {
      const result = parseWorkflow(
        {
          name: "test.yaml",
          content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      TEST: >-
        \${{ github.event_name }}
    steps:
      - run: echo hi`
        },
        nullTrace
      );

      expect(result.context.errors.getErrors()).toHaveLength(0);

      const workflowRoot = result.value!.assertMapping("root")!;
      const jobs = workflowRoot.get(1).value.assertMapping("jobs");
      const build = jobs.get(0).value.assertMapping("job");
      const env = build.get(1).value.assertMapping("env");
      const testToken = env.get(0).value;

      if (!isBasicExpression(testToken)) {
        throw new Error("expected TEST to be a basic expression");
      }

      expect(testToken.blockScalarHeader).toBe(">-");
    });

    it("preserves with explicit indent (|2)", () => {
      const result = parseWorkflow(
        {
          name: "test.yaml",
          content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      TEST: |2
        \${{ github.event_name }}
    steps:
      - run: echo hi`
        },
        nullTrace
      );

      expect(result.context.errors.getErrors()).toHaveLength(0);

      const workflowRoot = result.value!.assertMapping("root")!;
      const jobs = workflowRoot.get(1).value.assertMapping("jobs");
      const build = jobs.get(0).value.assertMapping("job");
      const env = build.get(1).value.assertMapping("env");
      const testToken = env.get(0).value;

      if (!isBasicExpression(testToken)) {
        throw new Error("expected TEST to be a basic expression");
      }

      expect(testToken.blockScalarHeader).toBe("|2");
    });

    it("preserves with explicit indent and strip (|-2)", () => {
      const result = parseWorkflow(
        {
          name: "test.yaml",
          content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      TEST: |-2
        \${{ github.event_name }}
    steps:
      - run: echo hi`
        },
        nullTrace
      );

      expect(result.context.errors.getErrors()).toHaveLength(0);

      const workflowRoot = result.value!.assertMapping("root")!;
      const jobs = workflowRoot.get(1).value.assertMapping("jobs");
      const build = jobs.get(0).value.assertMapping("job");
      const env = build.get(1).value.assertMapping("env");
      const testToken = env.get(0).value;

      if (!isBasicExpression(testToken)) {
        throw new Error("expected TEST to be a basic expression");
      }

      expect(testToken.blockScalarHeader).toBe("|-2");
    });

    it("handles flow scalars (no chomp info for inline)", () => {
      const result = parseWorkflow(
        {
          name: "test.yaml",
          content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      TEST: \${{ github.event_name }}
    steps:
      - run: echo hi`
        },
        nullTrace
      );

      expect(result.context.errors.getErrors()).toHaveLength(0);

      const workflowRoot = result.value!.assertMapping("root")!;
      const jobs = workflowRoot.get(1).value.assertMapping("jobs");
      const build = jobs.get(0).value.assertMapping("job");
      const env = build.get(1).value.assertMapping("env");
      const testToken = env.get(0).value;

      if (!isBasicExpression(testToken)) {
        throw new Error("expected TEST to be a basic expression");
      }

      expect(testToken.blockScalarHeader).toBeUndefined();
    });

    it("preserves block scalar info for format expressions with multiple sub-expressions", () => {
      const result = parseWorkflow(
        {
          name: "test.yaml",
          content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      TEST: |
        Hello \${{ github.event_name }} World \${{ github.ref }}
    steps:
      - run: echo hi`
        },
        nullTrace
      );

      expect(result.context.errors.getErrors()).toHaveLength(0);

      const workflowRoot = result.value!.assertMapping("root")!;
      const jobs = workflowRoot.get(1).value.assertMapping("jobs");
      const build = jobs.get(0).value.assertMapping("job");
      const env = build.get(1).value.assertMapping("env");
      const testToken = env.get(0).value;

      if (!isBasicExpression(testToken)) {
        throw new Error("expected TEST to be a basic expression");
      }

      // The format expression should preserve the block scalar info
      expect(testToken.blockScalarHeader).toBe("|");
    });

    it("preserves block scalar info on StringToken for isExpression fields", () => {
      const result = parseWorkflow(
        {
          name: "test.yaml",
          content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'push'
    steps:
      - run: echo hi`
        },
        nullTrace
      );

      expect(result.context.errors.getErrors()).toHaveLength(0);

      const workflowRoot = result.value!.assertMapping("root")!;
      const jobs = workflowRoot.get(1).value.assertMapping("jobs");
      const build = jobs.get(0).value.assertMapping("job");
      const ifToken = build.get(1).value;

      // For isExpression fields without ${{ }}, the token is a StringToken
      if (!isString(ifToken)) {
        throw new Error("expected if to be a string");
      }

      expect(ifToken.blockScalarHeader).toBe("|");
    });

    it("preserves block scalar info on StringToken for isExpression fields with strip", () => {
      const result = parseWorkflow(
        {
          name: "test.yaml",
          content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    if: |-
      github.event_name == 'push'
    steps:
      - run: echo hi`
        },
        nullTrace
      );

      expect(result.context.errors.getErrors()).toHaveLength(0);

      const workflowRoot = result.value!.assertMapping("root")!;
      const jobs = workflowRoot.get(1).value.assertMapping("jobs");
      const build = jobs.get(0).value.assertMapping("job");
      const ifToken = build.get(1).value;

      if (!isString(ifToken)) {
        throw new Error("expected if to be a string");
      }

      expect(ifToken.blockScalarHeader).toBe("|-");
    });
  });
});
