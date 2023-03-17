import {documentLinks} from "./document-links";
import {createDocument} from "./test-utils/document";
import {clearCache} from "./utils/workflow-cache";

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
});
