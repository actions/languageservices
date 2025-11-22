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

describe("block scalar chomping - number fields", () => {
  describe("job timeout-minutes", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: |
      \${{ matrix.timeout }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar adds trailing newline which breaks number parsing. Use '|-' to strip trailing newlines.",
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
    timeout-minutes: |+
      \${{ matrix.timeout }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar adds trailing newline which breaks number parsing. Use '|-' to strip trailing newlines.",
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
    timeout-minutes: |-
      \${{ matrix.timeout }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("container.ports", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    container:
      image: node:16
      ports: |
        \${{ fromJSON('[80, 443]') }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar adds trailing newline which breaks number parsing. Use '|-' to strip trailing newlines.",
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
    container:
      image: node:16
      ports: |+
        \${{ fromJSON('[8080, 9090]') }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar adds trailing newline which breaks number parsing. Use '|-' to strip trailing newlines.",
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
    container:
      image: node:16
      ports: |-
        \${{ fromJSON('[80, 443]') }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("container.volumes", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    container:
      image: node:16
      volumes: |
        \${{ fromJSON('["/data:/data"]') }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar adds trailing newline which breaks number parsing. Use '|-' to strip trailing newlines.",
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
    container:
      image: node:16
      volumes: |+
        \${{ fromJSON('["/data:/data"]') }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar adds trailing newline which breaks number parsing. Use '|-' to strip trailing newlines.",
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
    container:
      image: node:16
      volumes: |-
        \${{ fromJSON('["/data:/data"]') }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("services.ports", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        ports: |
          \${{ fromJSON('[5432]') }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar adds trailing newline which breaks number parsing. Use '|-' to strip trailing newlines.",
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
    services:
      postgres:
        image: postgres:14
        ports: |+
          \${{ fromJSON('[5432]') }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar adds trailing newline which breaks number parsing. Use '|-' to strip trailing newlines.",
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
    services:
      postgres:
        image: postgres:14
        ports: |-
          \${{ fromJSON('[5432]') }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("services.volumes", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        volumes: |
          \${{ fromJSON('["/var/lib/postgresql/data"]') }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar adds trailing newline which breaks number parsing. Use '|-' to strip trailing newlines.",
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
    services:
      postgres:
        image: postgres:14
        volumes: |+
          \${{ fromJSON('["/var/lib/postgresql/data"]') }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar adds trailing newline which breaks number parsing. Use '|-' to strip trailing newlines.",
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
    services:
      postgres:
        image: postgres:14
        volumes: |-
          \${{ fromJSON('["/var/lib/postgresql/data"]') }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("step timeout-minutes", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
        timeout-minutes: |
          \${{ matrix.timeout }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar adds trailing newline which breaks number parsing. Use '|-' to strip trailing newlines.",
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
        timeout-minutes: |+
          \${{ matrix.timeout }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar adds trailing newline which breaks number parsing. Use '|-' to strip trailing newlines.",
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
        timeout-minutes: |-
          \${{ matrix.timeout }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });
});
