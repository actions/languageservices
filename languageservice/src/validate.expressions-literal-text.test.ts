import {DiagnosticSeverity} from "vscode-languageserver-types";
import {registerLogger} from "./log.js";
import {createDocument} from "./test-utils/document.js";
import {TestLogger} from "./test-utils/logger.js";
import {clearCache} from "./utils/workflow-cache.js";
import {validate} from "./validate.js";

registerLogger(new TestLogger());

beforeEach(() => {
  clearCache();
});

describe("expression literal text in conditions", () => {
  describe("job-if", () => {
    it("errors when literal text mixed with embedded expression", async () => {
      const input = `
on: push
jobs:
  build:
    if: push == \${{ github.event_name }}
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Conditional expression contains literal text outside replacement tokens. This will cause the expression to always evaluate to truthy. Did you mean to put the entire expression inside ${{ }}?",
          code: "expression-literal-text-in-condition",
          severity: DiagnosticSeverity.Error
        })
      );
    });

    it("allows format with only replacement tokens", async () => {
      const input = `
on: push
jobs:
  build:
    if: \${{ format('{0}', github.event_name) }}
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).not.toContainEqual(
        expect.objectContaining({
          code: "expression-literal-text-in-condition"
        })
      );
    });

    it("allows format with only replacement tokens and whitespace", async () => {
      const input = `
on: push
jobs:
  build:
    if: \${{ format('{0}{1}', github.event_name, 'test') }}
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      // Only replacement tokens, no literal text
      expect(result).not.toContainEqual(
        expect.objectContaining({
          code: "expression-literal-text-in-condition"
        })
      );
    });

    it("errors with literal text and replacement tokens mixed", async () => {
      const input = `
on: push
jobs:
  build:
    if: \${{ format('event is {0}', github.event_name) }}
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Conditional expression contains literal text outside replacement tokens. This will cause the expression to always evaluate to truthy. Did you mean to put the entire expression inside ${{ }}?",
          code: "expression-literal-text-in-condition",
          severity: DiagnosticSeverity.Error
        })
      );
    });

    it("errors with escaped left brace followed by replacement token", async () => {
      const input = `
on: push
jobs:
  build:
    if: \${{ format('{{{0}', github.event_name) }}
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Conditional expression contains literal text outside replacement tokens. This will cause the expression to always evaluate to truthy. Did you mean to put the entire expression inside ${{ }}?",
          code: "expression-literal-text-in-condition",
          severity: DiagnosticSeverity.Error
        })
      );
    });
  });

  describe("step-if", () => {
    it("errors when literal text mixed with embedded expression", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - if: success == \${{ job.status }}
        run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Conditional expression contains literal text outside replacement tokens. This will cause the expression to always evaluate to truthy. Did you mean to put the entire expression inside ${{ }}?",
          code: "expression-literal-text-in-condition",
          severity: DiagnosticSeverity.Error
        })
      );
    });

    it("allows valid expressions", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - if: \${{ success() }}
        run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).not.toContainEqual(
        expect.objectContaining({
          code: "expression-literal-text-in-condition"
        })
      );
    });

    it("errors on unknown context in plain string if condition", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - if: foo == bar
        run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.some(d => d.message.includes("Unrecognized named-value"))).toBe(true);
    });
  });

  describe("snapshot-if", () => {
    it("errors when literal text mixed with embedded expression", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        os: [ubuntu-latest]
    steps:
      - run: echo hi
    snapshot:
      image-name: my-image
      if: ubuntu == \${{ matrix.os }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Conditional expression contains literal text outside replacement tokens. This will cause the expression to always evaluate to truthy. Did you mean to put the entire expression inside ${{ }}?",
          code: "expression-literal-text-in-condition",
          severity: DiagnosticSeverity.Error
        })
      );
    });
  });

  describe("non-if fields", () => {
    it("does not error for format in run", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ format('Event is {0}', github.event_name) }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      // Format with literal text is OK outside of if conditions
      expect(result).not.toContainEqual(
        expect.objectContaining({
          code: "expression-literal-text-in-condition"
        })
      );
    });
  });

  // https://github.com/github/vscode-github-actions/issues/542
  describe("YAML-quoted expressions", () => {
    it("allows double-quoted expression in job-if", async () => {
      // Quotes are needed when the expression contains a colon
      const input = `
on: push
jobs:
  publish:
    if: "\${{ startsWith(github.event.head_commit.message, 'chore: release') }}"
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).not.toContainEqual(
        expect.objectContaining({
          code: "expression-literal-text-in-condition"
        })
      );
    });

    it("allows single-quoted expression in job-if", async () => {
      const input = `
on: push
jobs:
  publish:
    if: '\${{ startsWith(github.event.head_commit.message, "chore: release") }}'
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).not.toContainEqual(
        expect.objectContaining({
          code: "expression-literal-text-in-condition"
        })
      );
    });

    it("allows double-quoted expression in step-if", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - if: "\${{ contains(github.event.head_commit.message, 'skip: ci') }}"
        run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).not.toContainEqual(
        expect.objectContaining({
          code: "expression-literal-text-in-condition"
        })
      );
    });

    it("still errors when there is actual literal text outside expression", async () => {
      // Even with quotes, if there's literal text outside ${{ }}, it should error
      const input = `
on: push
jobs:
  build:
    if: "push == \${{ github.event_name }}"
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          code: "expression-literal-text-in-condition"
        })
      );
    });

    it("errors on multiple expressions with literal text between them", async () => {
      const input = `
on: push
jobs:
  build:
    if: "\${{ true }} and \${{ false }}"
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          code: "expression-literal-text-in-condition"
        })
      );
    });
  });
});
