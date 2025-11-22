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

describe("expression validation", () => {
  describe("block scalar chomping - fields that warn only for clip", () => {
    describe("env", () => {
      it("warns with clip chomping", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo $VAR
        env:
          VAR: |
            \${{ matrix.value }}
`;
        const result = await validate(createDocument("wf.yaml", input));

        expect(result).toContainEqual(
          expect.objectContaining({
            message:
              "Block scalar adds trailing newline to expression result. Use '|-' to strip or '|+' to keep trailing newlines.",
            code: "expression-block-scalar-chomping",
            severity: DiagnosticSeverity.Warning
          })
        );
      });

      it("does not warn with keep chomping", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo $VAR
        env:
          VAR: |+
            \${{ matrix.value }}
`;
        const result = await validate(createDocument("wf.yaml", input));

        expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
      });

      it("does not warn with strip chomping", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo $VAR
        env:
          VAR: |-
            \${{ matrix.value }}
`;
        const result = await validate(createDocument("wf.yaml", input));

        expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
      });

      it("uses > indicator in warning message for folded scalars", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo $VAR
        env:
          VAR: >
            \${{ matrix.value }}
`;
        const result = await validate(createDocument("wf.yaml", input));

        expect(result).toContainEqual(
          expect.objectContaining({
            message:
              "Block scalar adds trailing newline to expression result. Use '>-' to strip or '>+' to keep trailing newlines.",
            code: "expression-block-scalar-chomping",
            severity: DiagnosticSeverity.Warning
          })
        );
      });
    });

    describe("action input", () => {
      it("warns with clip chomping", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          ref: |
            \${{ github.ref }}
`;
        const result = await validate(createDocument("wf.yaml", input));

        expect(result).toContainEqual(
          expect.objectContaining({
            message:
              "Block scalar adds trailing newline to expression result. Use '|-' to strip or '|+' to keep trailing newlines.",
            code: "expression-block-scalar-chomping",
            severity: DiagnosticSeverity.Warning
          })
        );
      });

      it("does not warn with keep chomping", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          ref: |+
            \${{ github.ref }}
`;
        const result = await validate(createDocument("wf.yaml", input));

        expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
      });

      it("does not warn with strip chomping", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          ref: |-
            \${{ github.ref }}
`;
        const result = await validate(createDocument("wf.yaml", input));

        expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
      });
    });

    describe("matrix value", () => {
      it("warns with clip chomping", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        version: |
          \${{ fromJSON('[1, 2, 3]') }}
    steps:
      - run: echo hi
`;
        const result = await validate(createDocument("wf.yaml", input));

        expect(result).toContainEqual(
          expect.objectContaining({
            message:
              "Block scalar adds trailing newline to expression result. Use '|-' to strip or '|+' to keep trailing newlines.",
            code: "expression-block-scalar-chomping",
            severity: DiagnosticSeverity.Warning
          })
        );
      });

      it("does not warn with keep chomping", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        version: |+
          \${{ fromJSON('[1, 2, 3]') }}
    steps:
      - run: echo hi
`;
        const result = await validate(createDocument("wf.yaml", input));

        expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
      });

      it("does not warn with strip chomping", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        version: |-
          \${{ fromJSON('[1, 2, 3]') }}
    steps:
      - run: echo hi
`;
        const result = await validate(createDocument("wf.yaml", input));

        expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
      });
    });
  });
});
