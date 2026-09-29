import {documentLinks} from "./document-links.js";
import {createDocument} from "./test-utils/document.js";
import {clearCache} from "./utils/workflow-cache.js";

beforeEach(() => {
  clearCache();
});

describe("documentLinks", () => {
  it("no links without actions", async () => {
    const input = `on: push
jobs:
  build:
    runs-on: [self-hosted]
    steps:
    - run: echo "Hello World"`;
    const result = await documentLinks(createDocument("test.yaml", input), undefined);
    expect(result).toHaveLength(0);
  });

  it("no links for invalid workflow", async () => {
    const input = `onFOO: push
jobs:
  build:
    runs-on: [self-hosted]`;
    const result = await documentLinks(createDocument("test.yaml", input), undefined);
    expect(result).toHaveLength(0);
  });

  it("links for actions in workflow", async () => {
    const input = `on: push
jobs:
  build:
    runs-on: [self-hosted]
    steps:
    - uses: actions/checkout@v2
    - uses: actions/checkout@v3
    - uses: github/codeql-action/init@v2`;
    const result = await documentLinks(createDocument("test.yaml", input), undefined);
    expect(result).toEqual([
      {
        range: {
          end: {
            character: 31,
            line: 5
          },
          start: {
            character: 12,
            line: 5
          }
        },
        target: "https://www.github.com/actions/checkout/tree/v2/",
        tooltip: "Open action on GitHub"
      },
      {
        range: {
          end: {
            character: 31,
            line: 6
          },
          start: {
            character: 12,
            line: 6
          }
        },
        target: "https://www.github.com/actions/checkout/tree/v3/",
        tooltip: "Open action on GitHub"
      },
      {
        range: {
          end: {
            character: 40,
            line: 7
          },
          start: {
            character: 12,
            line: 7
          }
        },
        target: "https://www.github.com/github/codeql-action/tree/v2/init",
        tooltip: "Open action on GitHub"
      }
    ]);
  });

  it("links for reusable local workflow", async () => {
    const input = `on: push
jobs:
  build:
    uses: ./.github/workflows/reusable-workflow.yml`;
    const result = await documentLinks(createDocument("test.yaml", input), "file:///workspace/");
    expect(result).toEqual([
      {
        range: {
          end: {
            character: 51,
            line: 3
          },
          start: {
            character: 10,
            line: 3
          }
        },
        target: "file:///workspace/.github/workflows/reusable-workflow.yml"
      }
    ]);
  });

  it("links for reusable remote workflow", async () => {
    const input = `on: push
jobs:
  build:
    uses: seismis-rainier/workflows/reusable-workflow.yml@main`;
    const result = await documentLinks(createDocument("test.yaml", input), "file:///workspace/");
    expect(result).toEqual([
      {
        range: {
          end: {
            character: 62,
            line: 3
          },
          start: {
            character: 10,
            line: 3
          }
        },
        target: "https://www.github.com/seismis-rainier/workflows/tree/main/reusable-workflow.yml",
        tooltip: "Open reusable workflow on GitHub"
      }
    ]);
  });

  it("links for actions in composite action", async () => {
    const input = `name: My Composite Action
description: A composite action with nested actions
runs:
  using: composite
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: echo "Hello"
      shell: bash`;
    const result = await documentLinks(createDocument("action.yml", input), undefined);
    expect(result).toHaveLength(2);
    expect(result[0].target).toBe("https://www.github.com/actions/checkout/tree/v4/");
    expect(result[0].tooltip).toBe("Open action on GitHub");
    expect(result[1].target).toBe("https://www.github.com/actions/setup-node/tree/v4/");
  });

  it("no links for non-composite action", async () => {
    const input = `name: My Node Action
description: A node action
runs:
  using: node20
  main: index.js`;
    const result = await documentLinks(createDocument("action.yml", input), undefined);
    expect(result).toHaveLength(0);
  });
});
