import {complete} from "./complete.js";
import {TextDocument} from "vscode-languageserver-textdocument";
import {clearCache} from "./utils/workflow-cache.js";
import {getPositionFromCursor} from "./test-utils/cursor-position.js";

beforeEach(() => {
  clearCache();
});

describe("Issue #81 - multi-line if expression completion", () => {
  it("should complete in block scalar if with | (exact position)", async () => {
    // Exact reproduction from issue - cursor after "github." in block scalar
    const input = `on: push

jobs:
  build:
    if: |
      github.
    runs-on: ubuntu-latest
    steps:
    - run: echo`;

    const doc = TextDocument.create("file:///test.yaml", "yaml", 1, input);
    // Line 5 (0-indexed) = "      github.", character 13 = after the dot
    const pos = {line: 5, character: 13};

    const result = await complete(doc, pos, {});

    expect(result.length).toBeGreaterThan(0);
    expect(result.map(x => x.label)).toContain("event");
    expect(result.map(x => x.label)).toContain("actor");
  });

  it("should complete in block scalar if with > (exact position)", async () => {
    const input = `on: push

jobs:
  build:
    if: >
      github.
    runs-on: ubuntu-latest
    steps:
    - run: echo`;

    const doc = TextDocument.create("file:///test.yaml", "yaml", 1, input);
    const pos = {line: 5, character: 13};

    const result = await complete(doc, pos, {});

    expect(result.length).toBeGreaterThan(0);
    expect(result.map(x => x.label)).toContain("event");
  });

  it("should complete in block scalar with multiple lines", async () => {
    const input = `on: push
jobs:
  build:
    if: |
      github.event_name == 'push' &&
      github.|
    runs-on: ubuntu-latest
    steps:
    - run: echo`;

    // Skip 1 to skip the `|` block scalar indicator (same character as cursor marker)
    const result = await complete(...getPositionFromCursor(input, 1), {});

    expect(result.length).toBeGreaterThan(0);
    expect(result.map(x => x.label)).toContain("event");
  });

  it("should complete step if in block scalar", async () => {
    const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: echo
      if: |
        github.
`;

    const doc = TextDocument.create("file:///test.yaml", "yaml", 1, input);
    // Line 7 = "        github.", character 15 = after the dot (8 spaces + 7 chars)
    const pos = {line: 7, character: 15};

    const result = await complete(doc, pos, {});

    expect(result.length).toBeGreaterThan(0);
    expect(result.map(x => x.label)).toContain("event");
  });

  it("should complete in block scalar with ${{ expression markers", async () => {
    // This case works because transform() skips lines with ${{
    // Note: Using explicit position because | appears in multiple places (block scalar, ||, cursor)
    const input = `on: push
jobs:
  build:
    if: |
      \${{
        github.ref == 'refs/heads/main' ||
        github.
    runs-on: ubuntu-latest
    steps:
    - run: echo`;

    const doc = TextDocument.create("file:///test.yaml", "yaml", 1, input);
    // Line 6 = "        github." = 8 spaces + 7 chars = 15 chars, cursor after dot is at char 15
    const pos = {line: 6, character: 15};

    const result = await complete(doc, pos, {});

    expect(result.length).toBeGreaterThan(0);
    expect(result.map(x => x.label)).toContain("ref");
    expect(result.map(x => x.label)).toContain("ref_name");
  });
});

describe("Edge cases for getOffsetInContent", () => {
  it("should complete in single-line if (not block scalar)", async () => {
    const input = `on: push
jobs:
  build:
    if: github.|
    runs-on: ubuntu-latest
    steps:
    - run: echo`;

    const result = await complete(...getPositionFromCursor(input), {});

    expect(result.length).toBeGreaterThan(0);
    expect(result.map(x => x.label)).toContain("event");
  });

  it("should complete on third content line of block scalar", async () => {
    const input = `on: push
jobs:
  build:
    if: |
      github.event_name == 'push' &&
      github.ref == 'refs/heads/main' &&
      github.|
    runs-on: ubuntu-latest
    steps:
    - run: echo`;

    const result = await complete(...getPositionFromCursor(input, 1), {});

    expect(result.length).toBeGreaterThan(0);
    expect(result.map(x => x.label)).toContain("event");
  });

  it("should complete when block scalar has empty first line", async () => {
    const input = `on: push
jobs:
  build:
    if: |

      github.|
    runs-on: ubuntu-latest
    steps:
    - run: echo`;

    const result = await complete(...getPositionFromCursor(input, 1), {});

    expect(result.length).toBeGreaterThan(0);
    expect(result.map(x => x.label)).toContain("event");
  });
});
