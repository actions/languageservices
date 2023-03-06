import {data, DescriptionDictionary} from "@github/actions-expressions";
import {Hover} from "vscode-languageserver-types";
import {ContextProviderConfig} from "./context-providers/config";
import {hover} from "./hover";
import {registerLogger} from "./log";
import {getPositionFromCursor} from "./test-utils/cursor-position";
import {TestLogger} from "./test-utils/logger";
import {clearCache} from "./utils/workflow-cache";

const contextProviderConfig: ContextProviderConfig = {
  getContext: async (context: string) => {
    switch (context) {
      case "github":
        return new DescriptionDictionary(
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
        );
    }

    return undefined;
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
});
