import {data} from "@github/actions-expressions";
import {CompletionItemKind} from "vscode-languageserver-types";
import {complete, getExpressionInput} from "./complete";
import {ContextProviderConfig} from "./context-providers/config";
import {registerLogger} from "./log";
import {getPositionFromCursor} from "./test-utils/cursor-position";
import {TestLogger} from "./test-utils/logger";

const contextProviderConfig: ContextProviderConfig = {
  getContext: async (context: string) => {
    switch (context) {
      case "github":
        return new data.Dictionary({
          key: "event",
          value: new data.StringData("push")
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

    expect(test("${{ gh |")).toBe(" gh ");
    expect(test("${{ gh |}}")).toBe(" gh ");
    expect(test("${{ vars| == 'test' }}")).toBe(" vars");
    expect(test("${{ fromJso|('test').bar == 'test' }}")).toBe(" fromJso");
    expect(test("${{ github.| == 'test' }}")).toBe(" github.");
    expect(test("test ${{ github.| == 'test' }}")).toBe(" github.");
    expect(test("${{ vars }} ${{ gh |}}")).toBe(" gh ");
  });

  describe("top-level auto-complete", () => {
    it("single region", async () => {
      const input = "run-name: ${{ | }}";
      const result = await complete(...getPositionFromCursor(input), undefined, undefined);

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

    it("single region with existing input", async () => {
      const input = "run-name: ${{ g| }}";
      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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
      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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
      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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
      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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
        const result = await complete(...getPositionFromCursor(input, 1), undefined, contextProviderConfig);

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
        const result = await complete(...getPositionFromCursor(input, 1), undefined, contextProviderConfig);

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
        const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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
        const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

        expect(result.map(x => x.label)).toEqual(["event"]);
      });
    });

    it("nested auto-complete", async () => {
      const input = "run-name: ${{ github.| }}";
      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

      expect(result.map(x => x.label)).toEqual(["event"]);
    });

    it("using default context provider", async () => {
      const input =
        "on: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    environment:\n      url: ${{ runner.| }}\n    steps:\n      - run: echo";
      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

      expect(result.map(x => x.label)).toEqual(["arch", "name", "os", "temp", "tool_cache"]);
    });

    it("job if", async () => {
      const input = `on: push
jobs:
  build:
    if: github.|
    runs-on: ubuntu-latest
    steps:
    - run: echo`;
      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

      expect(result.map(x => x.label)).toEqual(["event"]);
    });

    it("step if", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: echo
      if: github.|`;
      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

      expect(result.map(x => x.label)).toEqual(["event"]);
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
    const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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
    const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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
    const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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
    const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

    expect(result.map(x => x.label)).toEqual(["build_id"]);
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
    - run: echo "hello \${{ inputs.|
`;
    const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

    expect(result.map(x => x.label)).toEqual(["another-name", "name"]);
  });

  it("no inputs", async () => {
    const input = `
on:
  workflow_dispatch:
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
    - run: echo "hello \${{ inputs.|
`;
    const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

    expect(result).toEqual([]);
  });

  it("github context includes expected keys", async () => {
    const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: echo \${{ github.| }}
  `;

    const result = await complete(...getPositionFromCursor(input), undefined, undefined);

    expect(result.map(x => x.label)).toContain("actor");
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
      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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
      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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
      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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
      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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

      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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

      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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

      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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

      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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

      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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

      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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

      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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

      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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

      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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

      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

      expect(result.map(x => x.label)).toEqual(["color"]);
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

    const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

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
});
