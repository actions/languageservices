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

describe("block scalar chomping - string fields", () => {
  describe("run-name", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
run-name: |
  Test \${{ github.event_name }}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
          code: "expression-block-scalar-chomping",
          severity: DiagnosticSeverity.Error
        })
      );
    });

    it("errors with keep chomping", async () => {
      const input = `
on: push
run-name: |+
  Test \${{ github.event_name }}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
          code: "expression-block-scalar-chomping",
          severity: DiagnosticSeverity.Error
        })
      );
    });

    it("does not error with strip chomping", async () => {
      const input = `
on: push
run-name: |-
  Test \${{ github.event_name }}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("job name", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    name: |
      Build \${{ matrix.name }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    name: |+
      Build \${{ matrix.name }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    name: |-
      Build \${{ matrix.name }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("workflow job name", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  call-workflow:
    uses: ./.github/workflows/reusable.yml
    name: |
      Call \${{ matrix.name }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
          code: "expression-block-scalar-chomping",
          severity: DiagnosticSeverity.Error
        })
      );
    });

    it("errors with keep chomping", async () => {
      const input = `
on: push
jobs:
  call-workflow:
    uses: ./.github/workflows/reusable.yml
    name: |+
      Call \${{ matrix.name }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
          code: "expression-block-scalar-chomping",
          severity: DiagnosticSeverity.Error
        })
      );
    });

    it("does not error with strip chomping", async () => {
      const input = `
on: push
jobs:
  call-workflow:
    uses: ./.github/workflows/reusable.yml
    name: |-
      Call \${{ matrix.name }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("container (string form)", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    container: |
      \${{ matrix.container }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    container: |+
      \${{ matrix.container }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    container: |-
      \${{ matrix.container }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("container.image", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    container:
      image: |
        \${{ matrix.container }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
      image: |+
        \${{ matrix.image }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
      image: |-
        \${{ matrix.image }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("container.credentials", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    container:
      image: node:16
      credentials: |
        \${{ secrets.DOCKER_TOKEN }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
      credentials: |+
        \${{ secrets.DOCKER_TOKEN }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
      credentials: |-
        \${{ secrets.DOCKER_TOKEN }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("job defaults.run.shell", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        shell: |
          \${{ matrix.shell }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    defaults:
      run:
        shell: |+
          \${{ matrix.shell }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    defaults:
      run:
        shell: |-
          \${{ matrix.shell }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("job defaults.run.working-directory", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: |
          \${{ matrix.dir }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    defaults:
      run:
        working-directory: |+
          \${{ matrix.dir }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    defaults:
      run:
        working-directory: |-
          \${{ matrix.dir }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("job environment (string form)", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    environment: |
      \${{ matrix.env }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    environment: |+
      \${{ matrix.env }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    environment: |-
      \${{ matrix.env }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("job environment.name", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    environment:
      name: |
        \${{ matrix.env }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    environment:
      name: |+
        \${{ matrix.env }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    environment:
      name: |-
        \${{ matrix.env }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("job environment.url", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: |
        \${{ steps.deploy.outputs.url }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    environment:
      name: production
      url: |+
        \${{ steps.deploy.outputs.url }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    environment:
      name: production
      url: |-
        \${{ steps.deploy.outputs.url }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("services (string form)", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    services:
      redis: |
        \${{ matrix.redis-image }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
      redis: |+
        \${{ matrix.redis-image }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
      redis: |-
        \${{ matrix.redis-image }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("services.image", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: |
          \${{ matrix.postgres-version }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
        image: |+
          \${{ matrix.postgres-version }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
        image: |-
          \${{ matrix.postgres-version }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("services.credentials", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        credentials: |
          \${{ secrets.DOCKER_CREDS }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
        credentials: |+
          \${{ secrets.DOCKER_CREDS }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
        credentials: |-
          \${{ secrets.DOCKER_CREDS }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("runs-on (string form)", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: |
      \${{ matrix.os }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    runs-on: |+
      \${{ matrix.os }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    runs-on: |-
      \${{ matrix.os }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("runs-on array item", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on:
      - |
        \${{ matrix.os }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    runs-on:
      - |+
        \${{ matrix.os }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    runs-on:
      - |-
        \${{ matrix.os }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("runs-on.group", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on:
      group: |
        \${{ matrix.runner-group }}
      labels: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    runs-on:
      group: |+
        \${{ matrix.runner-group }}
      labels: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    runs-on:
      group: |-
        \${{ matrix.runner-group }}
      labels: ubuntu-latest
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("runs-on.labels (string form)", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on:
      labels: |
        \${{ matrix.labels }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    runs-on:
      labels: |+
        \${{ matrix.labels }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    runs-on:
      labels: |-
        \${{ matrix.labels }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("runs-on.labels array item", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on:
      labels:
        - |
          \${{ matrix.label }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    runs-on:
      labels:
        - |+
          \${{ matrix.label }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
    runs-on:
      labels:
        - |-
          \${{ matrix.label }}
    steps:
      - run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("step name", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: |
          Test \${{ matrix.name }}
        run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
      - name: |+
          Test \${{ matrix.name }}
        run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
      - name: |-
          Test \${{ matrix.name }}
        run: echo hi
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });

  describe("step working-directory", () => {
    it("errors with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
        working-directory: |
          \${{ matrix.dir }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
        working-directory: |+
          \${{ matrix.dir }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toContainEqual(
        expect.objectContaining({
          message: "Block scalar adds trailing newline. Use '|-' to strip trailing newlines.",
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
        working-directory: |-
          \${{ matrix.dir }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
    });
  });
});
