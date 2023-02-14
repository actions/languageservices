import {DescriptionDictionary} from "@github/actions-expressions";
import {StringData} from "@github/actions-expressions/data/string";
import {WorkflowContext} from "../context/workflow-context";
import {testGetWorkflowContext} from "../test-utils/test-workflow-context";
import {getNeedsContext} from "./needs";

describe("needs context", () => {
  describe("invalid workflow context", () => {
    it("jobs not defined", () => {
      const workflowContext = {} as WorkflowContext;
      expect(workflowContext.job).toBeUndefined();
      expect(workflowContext.reusableWorkflowJob).toBeUndefined();

      const context = getNeedsContext(workflowContext);
      expect(context).toEqual(new DescriptionDictionary());
    });
  });

  it("job without needs", async () => {
    const workflowContext = await testGetWorkflowContext(`on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: ec|ho`);

    const context = getNeedsContext(workflowContext);
    expect(context).toEqual(new DescriptionDictionary());
  });

  it("job with needs", async () => {
    const workflowContext = await testGetWorkflowContext(`on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - run: echo
  build:
    runs-on: ubuntu-latest
    needs: [test]
    steps:
    - run: ec|ho`);

    const context = getNeedsContext(workflowContext);
    expect(context.pairs().map(x => x.key)).toEqual(["test"]);
  });

  it("reusable job without needs", async () => {
    const workflowContext = await testGetWorkflowContext(`on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - run: echo
  build:
    uses: ./.github/workflows/some-reusable-wor|kflow.yml`);

    const context = getNeedsContext(workflowContext);
    expect(context).toEqual(new DescriptionDictionary());
  });

  it("reusable job with needs", async () => {
    const workflowContext = await testGetWorkflowContext(`on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - run: echo
  build:
    uses: ./.github/workflows/some-reusable-wor|kflow.yml
    needs: [test]`);

    const context = getNeedsContext(workflowContext);
    expect(context.pairs().map(x => x.key)).toEqual(["test"]);
  });

  describe("outputs", () => {
    it("regular job with outputs", async () => {
      const workflowContext = await testGetWorkflowContext(`
on: push
jobs:
  a:
    outputs:
      build_id: my-build-id
    runs-on: ubuntu-latest
    steps:
    - run: echo
  b:
    uses: ./.github/workflows/some-reusable-wor|kflow.yml
    needs: [a]
`);

      const context = getNeedsContext(workflowContext);

      const needs = context.get("a") as DescriptionDictionary;
      expect(needs).toBeDefined();

      const outputs = needs.get("outputs") as DescriptionDictionary;
      expect(outputs).toBeDefined();
      expect(outputs.pairs()).toEqual([
        {
          key: "build_id",
          value: new StringData("my-build-id"),
          description: undefined
        }
      ]);
    });

    it("reusable job with outputs", async () => {
      const workflowContext = await testGetWorkflowContext(`
on: push
jobs:
  a:
    uses: ./reusable-workflow-with-outputs.yaml

  b:
    needs: [a]
    runs-on: ubuntu-latest
    steps:
    - run: ec|ho
`);

      const context = getNeedsContext(workflowContext);

      const needs = context.get("a") as DescriptionDictionary;
      expect(needs).toBeDefined();

      const outputs = needs.get("outputs") as DescriptionDictionary;
      expect(outputs).toBeDefined();

      expect(outputs.pairs().map(x => x.key)).toEqual(["build_id"]);
      expect(outputs.pairs()).toEqual([
        {
          key: "build_id",
          value: new StringData("123"),
          description: "The resulting build ID"
        }
      ]);
    });
  });
});
