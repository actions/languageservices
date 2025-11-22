import {registerLogger} from "./log";
import {createDocument} from "./test-utils/document";
import {TestLogger} from "./test-utils/logger";
import {clearCache} from "./utils/workflow-cache";
import {validate} from "./validate";

registerLogger(new TestLogger());

beforeEach(() => {
  clearCache();
});

describe("block scalar chomping - allowed cases", () => {
  it("does NOT warn for step.run with clip chomping (exception)", async () => {
    const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo \${{ github.event_name }}
`;
    const result = await validate(createDocument("wf.yaml", input));

    expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
  });

  it("does not warn for inline expression", async () => {
    const input = `
on: push
jobs:
  build:
    if: \${{ github.event_name == 'push' }}
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
    const result = await validate(createDocument("wf.yaml", input));

    expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
  });

  it("does not warn for quoted string", async () => {
    const input = `
on: push
jobs:
  build:
    if: "\${{ github.event_name == 'push' }}"
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
    const result = await validate(createDocument("wf.yaml", input));

    expect(result.filter(d => d.code === "expression-block-scalar-chomping")).toEqual([]);
  });
});
