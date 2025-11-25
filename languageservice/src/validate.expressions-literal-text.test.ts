import {DiagnosticSeverity} from "vscode-languageserver-types";
import {registerLogger} from "./log";
import {createDocument} from "./test-utils/document";
import {TestLogger} from "./test-utils/logger";
import {clearCache} from "./utils/workflow-cache";
import {validate} from "./validate";

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
});
