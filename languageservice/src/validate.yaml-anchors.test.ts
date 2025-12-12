import {validate} from "./validate";
import {createDocument} from "./test-utils/document";
import {clearCache} from "./utils/workflow-cache";

beforeEach(() => {
  clearCache();
});

describe("YAML anchors and aliases", () => {
  it("should handle anchors and aliases in env", async () => {
    const doc = createDocument(
      "wf.yaml",
      `
on: push
jobs:
  job1:
    runs-on: ubuntu-latest
    env: &env
      ENV1: env1
      ENV2: env2
    steps:
      - run: exit 0
  job2:
    runs-on: ubuntu-latest
    env: *env
    steps:
      - run: exit 0
`
    );
    const result = await validate(doc);
    expect(result).toEqual([]);
  });

  it("should handle multiple aliases to the same anchor", async () => {
    const doc = createDocument(
      "wf.yaml",
      `
on: push
env: &shared
  SHARED: true
jobs:
  job1:
    runs-on: ubuntu-latest
    env: *shared
    steps:
      - run: exit 0
  job2:
    runs-on: ubuntu-latest
    env: *shared
    steps:
      - run: exit 0
  job3:
    runs-on: ubuntu-latest
    env: *shared
    steps:
      - run: exit 0
`
    );
    const result = await validate(doc);
    expect(result).toEqual([]);
  });

  it("should handle anchors in matrix strategy", async () => {
    const doc = createDocument(
      "wf.yaml",
      `
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include: &matrix-include
          - os: ubuntu-latest
            node: 18
          - os: windows-latest
            node: 20
    steps:
      - run: exit 0
  test2:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include: *matrix-include
    steps:
      - run: exit 0
`
    );
    const result = await validate(doc);
    expect(result).toEqual([]);
  });

  it("should handle anchors in steps", async () => {
    const doc = createDocument(
      "wf.yaml",
      `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - &checkout
        uses: actions/checkout@v4
      - run: npm test
  deploy:
    runs-on: ubuntu-latest
    steps:
      - *checkout
      - run: npm run deploy
`
    );
    const result = await validate(doc);
    expect(result).toEqual([]);
  });

  it("should handle scalar anchors", async () => {
    const doc = createDocument(
      "wf.yaml",
      `
on: push
jobs:
  build:
    runs-on: &runner ubuntu-latest
    steps:
      - run: exit 0
  test:
    runs-on: *runner
    steps:
      - run: exit 0
`
    );
    const result = await validate(doc);
    expect(result).toEqual([]);
  });

  it("should work without anchors (control test)", async () => {
    const doc = createDocument(
      "wf.yaml",
      `
on: push
jobs:
  job1:
    runs-on: ubuntu-latest
    env:
      ENV1: env1
      ENV2: env2
    steps:
      - run: exit 0
  job2:
    runs-on: ubuntu-latest
    env:
      ENV1: env1
      ENV2: env2
    steps:
      - run: exit 0
`
    );
    const result = await validate(doc);
    expect(result).toEqual([]);
  });

  it("should handle circular aliases without hanging", async () => {
    // This is an invalid use case (alias referencing parent) but should not hang
    const doc = createDocument(
      "wf.yaml",
      `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    env: &myenv
      FOO: bar
      nested: *myenv
    steps:
      - run: exit 0
`
    );
    // Should complete without hanging - circular portion is silently ignored
    // which may cause downstream validation errors, but that's acceptable
    const result = await validate(doc);
    expect(result).toBeDefined();
  });

  it("should handle undefined alias references", async () => {
    // Reference to non-existent anchor - yaml library should report error
    const doc = createDocument(
      "wf.yaml",
      `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    env: *nonexistent
    steps:
      - run: exit 0
`
    );
    const result = await validate(doc);
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });
});
