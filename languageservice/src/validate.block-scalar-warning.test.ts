import {FeatureFlags} from "@actions/expressions";
import {DiagnosticSeverity} from "vscode-languageserver-types";
import {registerLogger} from "./log.js";
import {createDocument} from "./test-utils/document.js";
import {TestLogger} from "./test-utils/logger.js";
import {clearCache} from "./utils/workflow-cache.js";
import {validate, ValidationConfig} from "./validate.js";

registerLogger(new TestLogger());

const configWithFlag: ValidationConfig = {
  featureFlags: new FeatureFlags({blockScalarChompingWarning: true})
};

beforeEach(() => {
  clearCache();
});

describe("block scalar chomping - warning cases", () => {
  describe("step-level env values", () => {
    it("warns with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo $VAR
        env:
          VAR: |
            \${{ matrix.value }}
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
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
      - run: echo $VAR
        env:
          VAR: |+
            \${{ matrix.value }}
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result.filter(d => d.code === "block-scalar-chomping")).toEqual([]);
    });

    it("does not warn with strip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo $VAR
        env:
          VAR: |-
            \${{ matrix.value }}
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result.filter(d => d.code === "block-scalar-chomping")).toEqual([]);
    });

    it("uses > indicator in warning message for folded scalars", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo $VAR
        env:
          VAR: >
            \${{ matrix.value }}
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '>' implicitly adds a trailing newline that may be unintentional. Use '>-' to remove it, or '>+' to explicitly keep it.",
          code: "block-scalar-chomping",
          severity: DiagnosticSeverity.Warning
        })
      );
    });

    it("warns for plain string env value with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo $VAR
        env:
          VAR: |
            hello world
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
          severity: DiagnosticSeverity.Warning
        })
      );
    });
  });

  describe("job-level env values", () => {
    it("warns with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      MY_VAR: |
        some value
    steps:
      - run: echo done
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
          severity: DiagnosticSeverity.Warning
        })
      );
    });
  });

  describe("workflow-level env values", () => {
    it("warns with clip chomping", async () => {
      const input = `
on: push
env:
  GLOBAL_VAR: |
    some value
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo done
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
          severity: DiagnosticSeverity.Warning
        })
      );
    });
  });

  describe("container env values", () => {
    it("warns with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    container:
      image: node:18
      env:
        CONTAINER_VAR: |
          some value
    steps:
      - run: echo done
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
          severity: DiagnosticSeverity.Warning
        })
      );
    });
  });

  describe("service container env values", () => {
    it("warns with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis
        env:
          REDIS_PASSWORD: |
            secret123
    steps:
      - run: echo done
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
          severity: DiagnosticSeverity.Warning
        })
      );
    });
  });

  describe("action input (with)", () => {
    it("warns with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          script: |
            \${{ matrix.value }}
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
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
      - uses: actions/checkout@v4
        with:
          script: |+
            \${{ matrix.value }}
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result.filter(d => d.code === "block-scalar-chomping")).toEqual([]);
    });

    it("does not warn with strip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          script: |-
            \${{ matrix.value }}
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result.filter(d => d.code === "block-scalar-chomping")).toEqual([]);
    });
  });

  describe("reusable workflow inputs (with)", () => {
    it("warns with clip chomping", async () => {
      const input = `
on: push
jobs:
  call-workflow:
    uses: ./.github/workflows/reusable.yml
    with:
      my-input: |
        some value
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
          severity: DiagnosticSeverity.Warning
        })
      );
    });
  });

  describe("reusable workflow secrets", () => {
    it("warns with clip chomping", async () => {
      const input = `
on: push
jobs:
  call-workflow:
    uses: ./.github/workflows/reusable.yml
    secrets:
      my-secret: |
        \${{ secrets.TOKEN }}
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
          severity: DiagnosticSeverity.Warning
        })
      );
    });
  });

  describe("job outputs", () => {
    it("warns with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      my_output: |
        \${{ steps.test.outputs.value }}
    steps:
      - id: test
        run: echo "value=test" >> $GITHUB_OUTPUT
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
          severity: DiagnosticSeverity.Warning
        })
      );
    });

    it("does not warn with strip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      my_output: |-
        \${{ steps.test.outputs.value }}
    steps:
      - id: test
        run: echo "value=test" >> $GITHUB_OUTPUT
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result.filter(d => d.code === "block-scalar-chomping")).toEqual([]);
    });
  });

  describe("matrix values", () => {
    it("warns for matrix vector value with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        config:
          - |
            value1
          - value2
    steps:
      - run: echo \${{ matrix.config }}
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
          severity: DiagnosticSeverity.Warning
        })
      );
    });

    it("does not warn with strip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        config:
          - |-
            value1
          - value2
    steps:
      - run: echo \${{ matrix.config }}
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result.filter(d => d.code === "block-scalar-chomping")).toEqual([]);
    });

    it("warns for matrix include value with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        os: [ubuntu-latest]
        include:
          - os: |
              windows-latest
            special: true
    steps:
      - run: echo \${{ matrix.os }}
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
          severity: DiagnosticSeverity.Warning
        })
      );
    });

    it("warns for matrix exclude value with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [16, 18]
        exclude:
          - os: |
              windows-latest
            node: 16
    steps:
      - run: echo \${{ matrix.os }}
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
          severity: DiagnosticSeverity.Warning
        })
      );
    });

    it("warns for deeply nested matrix value with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        config:
          - foo:
              bar: |
                baz
    steps:
      - run: echo \${{ matrix.config }}
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
          severity: DiagnosticSeverity.Warning
        })
      );
    });

    it("warns for deeply nested matrix include value with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        os: [ubuntu-latest]
        include:
          - os: ubuntu-latest
            config:
              nested: |
                value
    steps:
      - run: echo \${{ matrix.config }}
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
          severity: DiagnosticSeverity.Warning
        })
      );
    });

    it("warns for deeply nested matrix exclude value with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
        exclude:
          - os: windows-latest
            config:
              nested: |
                value
    steps:
      - run: echo \${{ matrix.os }}
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
          severity: DiagnosticSeverity.Warning
        })
      );
    });
  });

  describe("concurrency", () => {
    it("warns for concurrency string with clip chomping", async () => {
      const input = `
on: push
concurrency: |
  my-group-\${{ github.ref }}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo done
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
          severity: DiagnosticSeverity.Warning
        })
      );
    });

    it("does not warn for concurrency with strip chomping", async () => {
      const input = `
on: push
concurrency: |-
  my-group-\${{ github.ref }}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo done
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result.filter(d => d.code === "block-scalar-chomping")).toEqual([]);
    });

    it("warns for concurrency.group with clip chomping", async () => {
      const input = `
on: push
concurrency:
  group: |
    my-group-\${{ github.ref }}
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo done
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
          severity: DiagnosticSeverity.Warning
        })
      );
    });

    it("warns for job-level concurrency with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    concurrency: |
      job-group-\${{ github.ref }}
    steps:
      - run: echo done
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result).toContainEqual(
        expect.objectContaining({
          message:
            "Block scalar '|' implicitly adds a trailing newline that may be unintentional. Use '|-' to remove it, or '|+' to explicitly keep it.",
          code: "block-scalar-chomping",
          severity: DiagnosticSeverity.Warning
        })
      );
    });
  });
});

describe("block scalar chomping - no warning cases", () => {
  describe("fields trimmed server-side", () => {
    it("does not warn for job-if with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    if: |
      github.ref == 'refs/heads/main'
    steps:
      - run: echo done
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result.filter(d => d.code === "block-scalar-chomping")).toEqual([]);
    });

    it("does not warn for step-if with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo done
        if: |
          github.ref == 'refs/heads/main'
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result.filter(d => d.code === "block-scalar-chomping")).toEqual([]);
    });

    it("does not warn for runs-on with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: |
      ubuntu-latest
    steps:
      - run: echo done
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result.filter(d => d.code === "block-scalar-chomping")).toEqual([]);
    });

    it("does not warn for job name with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    name: |
      My Job
    runs-on: ubuntu-latest
    steps:
      - run: echo done
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result.filter(d => d.code === "block-scalar-chomping")).toEqual([]);
    });

    it("does not warn for step name with clip chomping", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: |
          My Step
        run: echo done
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result.filter(d => d.code === "block-scalar-chomping")).toEqual([]);
    });
  });

  describe("run field (intentionally allowed)", () => {
    it("does not warn for step run field", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo hello
          echo world
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result.filter(d => d.code === "block-scalar-chomping")).toEqual([]);
    });

    it("does not warn for run field with expression", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo \${{ github.ref }}
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result.filter(d => d.code === "block-scalar-chomping")).toEqual([]);
    });
  });

  describe("non-block scalars", () => {
    it("does not warn for quoted strings", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo $VAR
        env:
          VAR: "hello world"
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result.filter(d => d.code === "block-scalar-chomping")).toEqual([]);
    });

    it("does not warn for flow scalars", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo $VAR
        env:
          VAR: hello world
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result.filter(d => d.code === "block-scalar-chomping")).toEqual([]);
    });

    it("does not warn for inline expressions", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo $VAR
        env:
          VAR: \${{ matrix.value }}
`;
      const result = await validate(createDocument("wf.yaml", input), configWithFlag);

      expect(result.filter(d => d.code === "block-scalar-chomping")).toEqual([]);
    });
  });
});
