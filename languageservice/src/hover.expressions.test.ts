import {data, DescriptionDictionary} from "@actions/expressions";
import {format} from "@actions/expressions/funcs/format";
import {Hover} from "vscode-languageserver-types";
import {ContextProviderConfig} from "./context-providers/config";
import {hover} from "./hover";
import {registerLogger} from "./log";
import {getPositionFromCursor} from "./test-utils/cursor-position";
import {TestLogger} from "./test-utils/logger";
import {clearCache} from "./utils/workflow-cache";

const contextProviderConfig: ContextProviderConfig = {
  getContext: (context: string) => {
    switch (context) {
      case "github":
        return Promise.resolve(
          new DescriptionDictionary(
            {
              key: "event",
              value: new data.StringData("push"),
              description: "The event that triggered the workflow"
            },
            {
              key: "test",
              value: new DescriptionDictionary({
                key: "name",
                value: new data.StringData("push"),
                description: "Name for the test"
              }),
              description: "Test dictionary"
            }
          )
        );
    }

    return Promise.resolve(undefined);
  }
};

registerLogger(new TestLogger());

beforeEach(() => {
  clearCache();
});

describe("hover.expressions", () => {
  it("context access", async () => {
    const input = `on: push
run-name: \${{ github.even|t }}
jobs:
  build:
    runs-on: [self-hosted]`;
    const result = await hover(...getPositionFromCursor(input), {
      contextProviderConfig
    });
    expect(result).toEqual<Hover>({
      contents: "The event that triggered the workflow",
      range: {
        start: {line: 1, character: 14},
        end: {line: 1, character: 26}
      }
    });
  });

  it("context", async () => {
    const input = `on: push
run-name: \${{ git|hub.event }}
jobs:
  build:
    runs-on: [self-hosted]`;
    const result = await hover(...getPositionFromCursor(input), {
      contextProviderConfig
    });
    expect(result).toEqual<Hover>({
      contents:
        "Information about the workflow run. For more information, see [`github` context](https://docs.github.com/actions/learn-github-actions/contexts#github-context).",
      range: {
        start: {line: 1, character: 14},
        end: {line: 1, character: 20}
      }
    });
  });

  it("multiple expressions", async () => {
    const input = `on: push
run-name: \${{ git|hub.event }}-\${{ github.event }}
jobs:
  build:
    runs-on: [self-hosted]`;
    const result = await hover(...getPositionFromCursor(input), {
      contextProviderConfig
    });
    expect(result).toEqual<Hover>({
      contents:
        "Information about the workflow run. For more information, see [`github` context](https://docs.github.com/actions/learn-github-actions/contexts#github-context).",
      range: {
        start: {line: 1, character: 14},
        end: {line: 1, character: 20}
      }
    });
  });

  it("multi-line expression", async () => {
    const input = `on: push
jobs:
  build:
    runs-on: [self-hosted]
    steps:
    - run: |
        echo 'hello'
        echo '\${{ github.test.na|me }}
        echo 'world'
        echo '\${{ github.event.test }}`;
    const result = await hover(...getPositionFromCursor(input, 1), {
      contextProviderConfig
    });
    expect(result).toEqual<Hover>({
      contents: "Name for the test",
      range: {
        start: {line: 7, character: 18},
        end: {line: 7, character: 34}
      }
    });
  });

  it("built-in function", async () => {
    const input = `on: push
run-name: \${{ form|at('Run {0}', github.run_id) }}
jobs:
  build:
    runs-on: [self-hosted]`;
    const result = await hover(...getPositionFromCursor(input), {
      contextProviderConfig
    });

    expect(result).toEqual<Hover>({
      contents: format.description || "",
      range: {
        start: {line: 1, character: 14},
        end: {line: 1, character: 20}
      }
    });
  });

  it("schema-defined function", async () => {
    const input = `on: push
jobs:
  build:
    if: alwa|ys()
    runs-on: [self-hosted]`;
    const result = await hover(...getPositionFromCursor(input), {
      contextProviderConfig
    });

    expect(result).toEqual<Hover>({
      contents:
        "Causes the step to always execute, and returns `true`, even when canceled. The `always` expression is best used at the step level or on tasks that you expect to run even when a job is canceled. For example, you can use `always` to send logs even when a job is canceled.",
      range: {
        start: {line: 3, character: 11},
        end: {line: 3, character: 17}
      }
    });
  });

  it("schema-defined function with different casing", async () => {
    const input = `on: push
jobs:
  build:
    runs-on: [self-hosted]
    steps:
      - run: echo \${{ hash|Files('test.txt') }}`;
    const result = await hover(...getPositionFromCursor(input), {
      contextProviderConfig
    });

    expect(result).toEqual<Hover>({
      contents:
        "Returns a single hash for the set of files that matches the `path` pattern. You can provide a single `path` pattern or multiple `path` patterns separated by commas. The `path` is relative to the `GITHUB_WORKSPACE` directory and can only include files inside of the `GITHUB_WORKSPACE`. This function calculates an individual SHA-256 hash for each matched file, and then uses those hashes to calculate a final SHA-256 hash for the set of files. If the `path` pattern does not match any files, this returns an empty string. For more information about SHA-256, see \"[SHA-2](https://wikipedia.org/wiki/SHA-2).\"\n\nYou can use pattern matching characters to match file names. Pattern matching is case-insensitive on Windows. For more information about supported pattern matching characters, see \"[Workflow syntax for GitHub Actions](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#filter-pattern-cheat-sheet).\"",
      range: {
        start: {line: 5, character: 22},
        end: {line: 5, character: 31}
      }
    });
  });
});
