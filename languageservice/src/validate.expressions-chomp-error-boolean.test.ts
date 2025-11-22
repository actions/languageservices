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

describe("block scalar chomping - boolean fields", () => {
  describe("job continue-on-error", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    continue-on-error: |
      \${{ matrix.experimental }}
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
    runs-on: ubuntu-latest
    continue-on-error: |+
      \${{ matrix.experimental }}
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
    runs-on: ubuntu-latest
    continue-on-error: |-
      \${{ matrix.experimental }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("step continue-on-error", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
        continue-on-error: |
          \${{ matrix.experimental }}
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
      - run: echo hi
        continue-on-error: |+
          \${{ matrix.experimental }}
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
      - run: echo hi
        continue-on-error: |-
          \${{ matrix.experimental }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });
});
