import {data, DescriptionDictionary} from "@github/actions-expressions";
import {CompletionItem, CompletionItemKind} from "vscode-languageserver-types";
import {complete, getExpressionInput} from "./complete";
import {ContextProviderConfig} from "./context-providers/config";
import {registerLogger} from "./log";
import {getPositionFromCursor} from "./test-utils/cursor-position";
import {TestLogger} from "./test-utils/logger";

const contextProviderConfig: ContextProviderConfig = {
  getContext: async (context: string) => {
    switch (context) {
      case "github":
        return new DescriptionDictionary({
          key: "event",
          value: new data.StringData("push"),
          description: "The event that triggered the workflow"
        });
    }

    return undefined;
  }
};

registerLogger(new TestLogger());

describe("expressions", () => {
  it("input extraction", () => {
    const test = (input: string) => {
      const [doc, pos] = getPositionFromCursor(input);
      return getExpressionInput(doc.getText(), pos.character);
    };

    // With ${{ }}
    expect(test("${{ gh |")).toBe(" gh ");
    expect(test("${{ gh |}}")).toBe(" gh ");
    expect(test("${{ vars| == 'test' }}")).toBe(" vars");
    expect(test("${{ fromJso|('test').bar == 'test' }}")).toBe(" fromJso");
    expect(test("${{ github.| == 'test' }}")).toBe(" github.");
    expect(test("test ${{ github.| == 'test' }}")).toBe(" github.");
    expect(test("${{ vars }} ${{ gh |}}")).toBe(" gh ");

    expect(test("${{ test.|")).toBe(" test.");
    expect(test("${{ test.| }}")).toBe(" test.");
    expect(test("${{ 1 == (test.|)")).toBe(" 1 == (test.");

    // Without ${{ }}
    expect(test("gh |")).toBe("gh ");
    expect(test("gh |}}")).toBe("gh ");
    expect(test("vars| == 'test' }}")).toBe("vars");
    expect(test("fromJso|('test').bar == 'test' }}")).toBe("fromJso");
    expect(test("github.| == 'test' }}")).toBe("github.");
    expect(test("github.| == 'test' }}")).toBe("github.");

    expect(test("test.|")).toBe("test.");
    expect(test("test.| }}")).toBe("test.");
    expect(test("1 == (test.|)")).toBe("1 == (test.");
  });

  describe("top-level auto-complete", () => {
    it("single region", async () => {
      const input = "run-name: ${{ | }}";
      const result = await complete(...getPositionFromCursor(input));

      expect(result.map(x => x.label)).toEqual([
        "github",
        "inputs",
        "vars",
        "contains",
        "endsWith",
        "format",
        "fromJson",
        "join",
        "startsWith",
        "toJson"
      ]);
    });

    it("within parentheses", async () => {
      const result = await complete(...getPositionFromCursor("run-name: ${{ 1 == (github.|) }}"), {
        contextProviderConfig
      });

      expect(result.map(x => x.label)).toEqual(["event"]);
    });

    it("contains description", async () => {
      const input = "run-name: ${{ github.| }}";
      const result = await complete(...getPositionFromCursor(input));

      expect(result).toContainEqual<CompletionItem>({
        label: "api_url",
        documentation: {
          kind: "markdown",
          value: "The URL of the GitHub Actions REST API."
        },
        kind: CompletionItemKind.Variable
      });
    });

    it("single region with existing input", async () => {
      const input = "run-name: ${{ g| }}";
      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual([
        "github",
        "inputs",
        "vars",
        "contains",
        "endsWith",
        "format",
        "fromJson",
        "join",
        "startsWith",
        "toJson"
      ]);
    });

    it("single region with existing condition", async () => {
      const input = "run-name: ${{ g| == 'test' }}";
      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual([
        "github",
        "inputs",
        "vars",
        "contains",
        "endsWith",
        "format",
        "fromJson",
        "join",
        "startsWith",
        "toJson"
      ]);
    });

    it("multiple regions with partial function", async () => {
      const input = "run-name: Run a ${{ inputs.test }} one-line script ${{ from|('test') == inputs.name }}";
      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual([
        "github",
        "inputs",
        "vars",
        "contains",
        "endsWith",
        "format",
        "fromJson",
        "join",
        "startsWith",
        "toJson"
      ]);
    });

    it("multiple regions - first region", async () => {
      const input = "run-name: test-${{ git| == 1 }}-${{ github.event }}";
      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual([
        "github",
        "inputs",
        "vars",
        "contains",
        "endsWith",
        "format",
        "fromJson",
        "join",
        "startsWith",
        "toJson"
      ]);
    });

    it("multiple regions", async () => {
      const input = "run-name: test-${{ github }}-${{ | }}";
      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual([
        "github",
        "inputs",
        "vars",
        "contains",
        "endsWith",
        "format",
        "fromJson",
        "join",
        "startsWith",
        "toJson"
      ]);
    });

    describe("multi-line strings", () => {
      it("indented |", async () => {
        const input = `on: push
jobs:
  build:
    steps:
      - run: |
          first line
          test \${{ github.| }}
          test2`;
        const result = await complete(...getPositionFromCursor(input, 1), {contextProviderConfig});

        expect(result.map(x => x.label)).toEqual(["event"]);
      });

      it("indented |+", async () => {
        const input = `on: push
jobs:
  build:
    steps:
      - run: |+
          first line
          test \${{ github.| }}
          test2`;
        const result = await complete(...getPositionFromCursor(input, 1), {contextProviderConfig});

        expect(result.map(x => x.label)).toEqual(["event"]);
      });

      it("indented >", async () => {
        const input = `on: push
jobs:
  build:
    steps:
      - run: >
          first line
          test \${{ github.| }}
          test2`;
        const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

        expect(result.map(x => x.label)).toEqual(["event"]);
      });

      it("indented >+", async () => {
        const input = `on: push
jobs:
  build:
    steps:
      - run: >+
          first line
          test \${{ github.| }}
          test2`;
        const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

        expect(result.map(x => x.label)).toEqual(["event"]);
      });
    });

    it("nested with parentheses", async () => {
      const input = `on:
  workflow_dispatch:
    inputs:
      test:
        type: string

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      foo: '{}'
    steps:
      - name: "\${{ fromJSON('test') == (inputs.|) }}"`;
      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual(["test"]);
    });

    it("nested auto-complete", async () => {
      const input = "run-name: ${{ github.| }}";
      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual(["event"]);
    });

    it("auto-complete partial", async () => {
      const input = "run-name: ${{ github.ev| }}";
      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual(["event"]);
    });

    it("using default context provider", async () => {
      const input =
        "on: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    environment:\n      url: ${{ runner.| }}\n    steps:\n      - run: echo";
      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual(["arch", "name", "os", "temp", "tool_cache"]);
    });

    describe("job if", () => {
      describe("without ${{", () => {
        it("simple", async () => {
          const input = `on: push
jobs:
  build:
    if: github.|
    runs-on: ubuntu-latest
    steps:
    - run: echo`;
          const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

          expect(result.map(x => x.label)).toEqual(["event"]);
        });

        it("complex", async () => {
          const input = `on: push
jobs:
  build:
    if: false && github.| == 'some-repo'
    runs-on: ubuntu-latest
    steps:
    - run: echo`;
          const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

          expect(result.map(x => x.label)).toEqual(["event"]);
        });
      });

      describe("with ${{", () => {
        it("simple", async () => {
          const input = `on: push
jobs:
  build:
    if: \${{ github.| }}
    runs-on: ubuntu-latest
    steps:
    - run: echo`;
          const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

          expect(result.map(x => x.label)).toEqual(["event"]);
        });

        it("complex", async () => {
          const input = `on: push
jobs:
  build:
    if: \${{ false && github.| == 'some-repo' }}
    runs-on: ubuntu-latest
    steps:
    - run: echo`;
          const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

          expect(result.map(x => x.label)).toEqual(["event"]);
        });
      });
    });

    describe("step if", () => {
      it("with ${{", async () => {
        const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: echo
      if: \${{ github.| }}`;
        const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

        expect(result.map(x => x.label)).toEqual(["event"]);
      });

      it("without ${{", async () => {
        const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: echo
      if: github.|`;
        const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

        expect(result.map(x => x.label)).toEqual(["event"]);
      });
    });
  });

  it("context inherited from parent", async () => {
    // The token definition is just a `string` and
    // the parent `step-with` holds the allowed context
    const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/deploy@v100
      with:
        deploy-key: \${{ secrets.|
`;
    const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

    expect(result.map(x => x.label)).toEqual(["GITHUB_TOKEN"]);
  });

  it("needs context only includes referenced jobs", async () => {
    const input = `
on: push
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
    - run: echo hello a
  b:
    needs: [a]
    runs-on: ubuntu-latest
    steps:
    - run: echo hello b
  c:
    needs: [b]
    runs-on: ubuntu-latest
    steps:
    - run: echo "hello \${{ needs.|
`;
    const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

    expect(result.map(x => x.label)).toEqual(["b"]);
  });

  it("needs.<job_id>", async () => {
    const input = `
on: push
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
    - run: echo hello a
  b:
    needs: [a]
    runs-on: ubuntu-latest
    steps:
    - run: echo "hello \${{ needs.a.|
`;
    const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

    expect(result.map(x => x.label)).toEqual(["outputs", "result"]);
  });

  it("needs.<job_id>.outputs includes outputs", async () => {
    const input = `
on: push
jobs:
  a:
    outputs:
      build_id: my-build-id
    runs-on: ubuntu-latest
    steps:
    - run: echo hello a
  b:
    needs: [a]
    runs-on: ubuntu-latest
    steps:
    - run: echo "hello \${{ needs.a.outputs.|
`;
    const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

    expect(result.map(x => x.label)).toEqual(["build_id"]);
  });

  it("env steps context only for current step and job", async () => {
    const input = `
on: push
env:
  envwf: workflow_env
jobs:
  a:
    runs-on: ubuntu-latest
    env:
      envjoba: job_a_env
  b:
    runs-on: ubuntu-latest
    env:
      envjobb: job_b_env
    steps:
    - name: step a
      run: echo "hello"
      env:
        envstepa: step_a_env
    - name: step b
      run: echo "hello \${{ env.|
      env:
        envstepb: step_b_env
`;
    const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

    expect(result.map(x => x.label)).toEqual(["envjobb", "envstepb", "envwf"]);
  });

  it("inputs", async () => {
    const input = `
on:
  workflow_dispatch:
    inputs:
      name:
        type: string
        default: some value
      another-name:
        type: string
  workflow_call:
    inputs:
      name:
          type: string
          default: value
      third-name:
        type: boolean
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
    - run: echo "hello \${{ inputs.|
`;
    const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

    expect(result.map(x => x.label)).toEqual(["another-name", "name", "third-name"]);
  });

  it("no inputs", async () => {
    const input = `
on:
  workflow_dispatch:
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
    - run: echo "hello \${{ inputs.|
`;
    const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

    expect(result).toEqual([]);
  });

  describe("github context", () => {
    it("includes expected keys", async () => {
      const input = `
  on: push

  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - run: echo \${{ github.| }}
    `;

      const result = await complete(...getPositionFromCursor(input));

      expect(result.map(x => x.label)).toContain("actor");
    });

    it("includes event inputs", async () => {
      const input = `
  on:
    workflow_dispatch:
      inputs:
        name:
          type: string
          default: some value
        another-name:
          type: string
    workflow_call:
      inputs:
        name:
          type: string
          default: value
        third-name:
          type: boolean
  jobs:
    a:
      runs-on: ubuntu-latest
      steps:
      - run: echo "hello \${{ github.event.inputs.|
  `;
      const result = await complete(...getPositionFromCursor(input));

      expect(result.map(x => x.label)).toEqual(["another-name", "name", "third-name"]);
    });

    it("excludes event inputs and cron when no relevant events", async () => {
      const input = `
  on: push

  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - run: echo \${{ github.event.| }}
    `;

      const result = await complete(...getPositionFromCursor(input));

      expect(result.map(x => x.label)).not.toContain("inputs");
      expect(result.map(x => x.label)).not.toContain("schedule");
    });

    it("includes cron schedules", async () => {
      const input = `
  on:
    schedule:
    - cron: '0 0 * * *'

  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - run: echo \${{ github.event.| }}
    `;

      const result = await complete(...getPositionFromCursor(input));

      expect(result.map(x => x.label)).toEqual(["repository", "schedule", "workflow"]);
    });

    it("includes event payload", async () => {
      const input = `
  on: [push, pull_request]

  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - run: echo \${{ github.event.| }}
    `;

      const result = await complete(...getPositionFromCursor(input));

      // forced is part of the push event payload
      expect(result.map(x => x.label)).toContain("forced");
      // pull_request is part of the pull_request event payload
      expect(result.map(x => x.label)).toContain("pull_request");
    });

    it("includes event payload for workflow_call", async () => {
      const input = `
  on: [workflow_call]

  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - run: echo \${{ github.event.| }}
    `;

      const result = await complete(...getPositionFromCursor(input));

      // We don't validate github.event for workflow_call,
      // but there should still be auto-completion suggestions
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("steps context", () => {
    it("includes defined step IDs", async () => {
      const input = `
on: push
jobs:
  one:
    runs-on: ubuntu-latest
    steps:
    - id: a
      run: echo hello a
    - id: b
      run: echo hello b
    - id: c
      run: echo "hello \${{ steps.|
`;
      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual(["a", "b"]);
    });

    it("step.<step_id>", async () => {
      const input = `
on: push
jobs:
  one:
    runs-on: ubuntu-latest
    steps:
    - id: a
      run: echo hello a
    - run: echo "hello \${{ steps.a.|
    `;
      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual(["conclusion", "outcome", "outputs"]);
    });

    it("ignores IDs from later steps", async () => {
      const input = `
on: push
jobs:
  one:
    runs-on: ubuntu-latest
    steps:
    - id: a
      run: echo hello a
    - id: b
      run: echo "hello \${{ steps.|
    - id: c
      run: echo hello c
  `;
      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual(["a"]);
    });

    it("Ignores generated IDs", async () => {
      const input = `
  on: push
  jobs:
    one:
      runs-on: ubuntu-latest
      steps:
      - run: echo hello a
      - id: b
        run: echo hello b
      - run: echo "hello \${{ steps.|
  `;
      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual(["b"]);
    });
  });

  describe("strategy context", () => {
    it("strategy is not suggested when outside of a matrix job", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm test > test-job-\${{ | }}.txt
`;

      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).not.toContain("strategy");
    });

    it("strategy is suggested within a matrix job", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-group: [1, 2]
        node: [14, 16]
    steps:
      - uses: actions/checkout@v3
      - run: npm test > test-job-\${{ | }}.txt
`;

      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toContain("strategy");
    });

    it("includes expected keys", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-group: [1, 2]
        node: [14, 16]
    steps:
      - uses: actions/checkout@v3
      - run: npm test > test-job-\${{ strategy.| }}.txt
  `;

      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual(["fail-fast", "job-index", "job-total", "max-parallel"]);
    });
  });

  describe("matrix context", () => {
    it("matrix is not suggested when outside of a matrix job", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm test > test-job-\${{ | }}.txt
`;

      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).not.toContain("strategy");
    });

    it("matrix is suggested within a matrix job", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-group: [1, 2]
        node: [14, 16]
    steps:
      - uses: actions/checkout@v3
      - run: npm test > test-job-\${{ | }}.txt
`;

      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toContain("strategy");
    });

    it("basic matrix job", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: \${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [14, 16]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: \${{ matrix.| }}
`;

      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual(["node", "os"]);
    });

    it("matrix with include", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        fruit: [apple, pear]
        animal: [cat, dog]
        include:
          - color: green
          - color: pink
            animal: cat
          - fruit: apple
            shape: circle
          - fruit: banana
          - fruit: banana
            animal: cat
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: \${{ matrix.| }}
`;

      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual(["animal", "color", "fruit", "shape"]);
    });

    it("matrix from expression", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix: \${{ fromJSON('{"color":["green","blue"]}') }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: \${{ matrix.| }}
`;

      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual([]);
    });

    it("matrix with include expression", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: \${{ matrix.os }}
    strategy:
      matrix:
        fruit: [apple, pear]
        animal: [cat, dog]
        include: \${{ fromJSON('{"color":"green"}') }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: \${{ matrix.| }}
`;

      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual(["animal", "fruit"]);
    });

    it("matrix with expression in property", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        color: \${{ fromJSON('["green","blue"]') }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: \${{ matrix.| }}
`;

      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

      expect(result.map(x => x.label)).toEqual(["color"]);
    });
  });

  describe("job context", () => {
    it("job context is suggested within a job", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    container:
      image: node:14.16
    services:
      nginx:
        image: node:14.16
    steps:
      - run: echo \${{ job.| }}
`;

      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});
      expect(result.map(x => x.label)).toEqual(["container", "services", "status"]);
    });

    it("job context is suggested within a job output", async () => {
      const input = `
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    outputs:
      environment: \${{ | }}
    steps:
      - id: a
        run: echo hi
`;

      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});
      expect(result.map(x => x.label)).toEqual([
        "env",
        "github",
        "inputs",
        "job",
        "needs",
        "runner",
        "secrets",
        "steps",
        "vars",
        "contains",
        "endsWith",
        "format",
        "fromJson",
        "join",
        "startsWith",
        "toJson"
      ]);
    });

    it("step context is suggested within a job output", async () => {
      const input = `
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    outputs:
      environment: \${{ steps.| }}
    steps:
      - id: foo
        run: echo hi
`;

      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});
      expect(result.map(x => x.label)).toEqual(["foo"]);
    });

    it("container context is suggested within a job container", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    container:
      image: node:14.16
    steps:
      - run: echo \${{ job.container.| }}
`;

      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});
      expect(result.map(x => x.label)).toEqual(["id", "network"]);
    });

    it("services are suggested within a job services list", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      nginx:
        image: node:14.16
      redis:
        image: redis
    steps:
      - run: echo \${{ job.services.| }}
`;

      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});
      expect(result.map(x => x.label)).toEqual(["nginx", "redis"]);
    });

    it("services context is suggested within a job service", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      nginx:
        image: node:14.16
        ports:
          - 80:8080
          - 90
    steps:
      - run: echo \${{ job.services.nginx.| }}
`;

      const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});
      expect(result.map(x => x.label)).toEqual(["id", "network", "ports"]);
    });
  });

  it("context completion items include kind and insert text", async () => {
    const input = `
    on: push

    jobs:
      test:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v3
          - run: echo \${{ | }}.txt
    `;

    const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

    // Built-in function
    const toJSON = result.find(x => x.label === "toJson");
    expect(toJSON).toBeDefined();
    expect(toJSON!.kind).toBe(CompletionItemKind.Function);
    expect(toJSON!.insertText).toBe("toJson()");

    // Function from context
    const hashFiles = result.find(x => x.label === "hashFiles");
    expect(hashFiles).toBeDefined();
    expect(hashFiles!.kind).toBe(CompletionItemKind.Function);
    expect(hashFiles!.insertText).toBe("hashFiles()");

    // Not a function
    const github = result.find(x => x.label === "github");
    expect(github).toBeDefined();
    expect(github!.kind).toBe(CompletionItemKind.Variable);
    expect(github!.insertText).toBeUndefined();
  });

  it("function parentheses are not inserted when parentheses already exist", async () => {
    const input = `
    on: push

    jobs:
      test:
        runs-on: ubuntu-latest
        steps:
          - run: echo \${{ toJS|(github.event) }}
    `;

    const result = await complete(...getPositionFromCursor(input), {contextProviderConfig});

    expect(result.find(x => x.label === "toJson")!.insertText).toBe("toJson");
  });
});
