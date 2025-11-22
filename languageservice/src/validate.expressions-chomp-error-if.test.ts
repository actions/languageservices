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

describe("block scalar chomping - if fields", () => {
  describe("job-if", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    if: |
      \${{ github.event_name == 'push' }}
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar adds trailing newline which breaks boolean evaluation. Use '|-' to strip trailing newlines.",
          code: "expression-block-scalar-chomping",
          severity: DiagnosticSeverity.Error
        })
      );
    });

    it("errors with keep chomping", async () => {
      const input = `
on: push
jobs:
  build:
    if: |+
      \${{ github.event_name == 'push' }}
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar adds trailing newline which breaks boolean evaluation. Use '|-' to strip trailing newlines.",
          code: "expression-block-scalar-chomping",
          severity: DiagnosticSeverity.Error
        })
      );
    });

    it("does not error with strip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    if: |-
      \${{ github.event_name == 'push' }}
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });

    it("errors without ${{ }} (isExpression)", async () => {
      const input = `
on: push
jobs:
  build:
    if: |
      github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar adds trailing newline which breaks boolean evaluation. Use '|-' to strip trailing newlines.",
          code: "expression-block-scalar-chomping",
          severity: DiagnosticSeverity.Error
        })
      );
    });

    it("uses > indicator in error message for folded scalars", async () => {
      const input = `
on: push
jobs:
  build:
    if: >
      \${{ github.event_name == 'push' }}
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar adds trailing newline which breaks boolean evaluation. Use '>-' to strip trailing newlines.",
          code: "expression-block-scalar-chomping",
          severity: DiagnosticSeverity.Error
        })
      );
    });
  });

  describe("step-if", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - if: |
          \${{ github.event_name == 'push' }}
        run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar adds trailing newline which breaks boolean evaluation. Use '|-' to strip trailing newlines.",
          code: "expression-block-scalar-chomping",
          severity: DiagnosticSeverity.Error
        })
      );
    });

    it("errors with keep chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - if: |+
          \${{ github.event_name == 'push' }}
        run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar adds trailing newline which breaks boolean evaluation. Use '|-' to strip trailing newlines.",
          code: "expression-block-scalar-chomping",
          severity: DiagnosticSeverity.Error
        })
      );
    });

    it("does not error with strip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - if: |-
          \${{ github.event_name == 'push' }}
        run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });
});
