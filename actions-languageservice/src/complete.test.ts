import { complete } from "./complete";
import { getPositionFromCursor } from "./test-utils/cursor-position";
import {
  Value,
  ValueProviderConfig,
  WorkflowContext,
} from "./value-providers/config";

describe("completion", () => {
  it("runs-on", async () => {
    const input = "on: push\njobs:\n  build:\n    runs-on: |";
    const result = await complete(...getPositionFromCursor(input));

    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(11);
    expect(result[0].label).toEqual("macos-10.13");
  });

  it("empty workflow", async () => {
    const input = "|";
    const result = await complete(...getPositionFromCursor(input));

    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(8);
    expect(result[0].label).toEqual("concurrency");
  });

  it("completion within a sequence", async () => {
    const input = `on: push
jobs:
  build:
      runs-on: [self-hosted, u|]`;
    const result = await complete(...getPositionFromCursor(input));

    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(10);

    expect(result[0].label).toEqual("macos-10.13");
  });

  it("sequence filters out existing values", async () => {
    const input = `on: push
jobs:
  build:
      runs-on: [ubuntu-latest, u|]`;
    const result = await complete(...getPositionFromCursor(input));

    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(10);

    expect(result[0].label).toEqual("macos-10.13");
  });

  it("one-of definition completion", async () => {
    const input = `on: push
jobs:
  build:
    |`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(20);
  });

  it("map keys filter out existing values", async () => {
    const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    |`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result.map((x) => x.label)).not.toContain("runs-on");
  });

  it("one-of narrows down to a specific type", async () => {
    // A job could be a job-factory or a workflow-job (callable workflow with uses)
    // If we have `runs-on`, we should be able to identify that we're in a job-factory
    const jobFactory = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    |`;
    const jobFactoryResult = await complete(
      ...getPositionFromCursor(jobFactory)
    );
    expect(jobFactoryResult).not.toBeUndefined();
    expect(jobFactoryResult.map((x) => x.label)).not.toContain("uses");

    const workflowJob = `on: push
    jobs:
      build:
        uses: octo-org/this-repo/.github/workflows/workflow-1.yml@172239021f7ba04fe7327647b213799853a9eb89
        |`;
    const workflowJobResult = await complete(
      ...getPositionFromCursor(workflowJob)
    );
    expect(workflowJobResult).not.toBeUndefined();
    expect(workflowJobResult.map((x) => x.label)).not.toContain("runs-on");
  });

  it("completes boolean values", async () => {
    const input = `on: push
jobs:
  build:
    continue-on-error: t|`;
    const result = await complete(...getPositionFromCursor(input));

    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(2);

    expect(result.map((x) => x.label).sort()).toEqual(["false", "true"]);
  });

  it("completes for empty map values", async () => {
    const input = `on: push
jobs:
  build:
    continue-on-error: |`;
    const result = await complete(...getPositionFromCursor(input));

    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(2);

    expect(result.map((x) => x.label).sort()).toEqual(["false", "true"]);
  });

  it("does not complete empty map values when cursor is immediately after the position", async () => {
    const input = `on: push
jobs:
  build:
    continue-on-error:|`;
    const result = await complete(...getPositionFromCursor(input));

    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(0);
  });

  it("custom value providers override defaults", async () => {
    const input = "on: push\njobs:\n  build:\n    runs-on: |";

    const getCustomValues = async (
      key: string,
      _: WorkflowContext
    ): Promise<Value[] | undefined> => {
      if (key === "runs-on") {
        return [{ label: "my-custom-label" }];
      }
      return [];
    };
    const config: ValueProviderConfig = {
      getCustomValues: getCustomValues,
    };
    const result = await complete(...getPositionFromCursor(input), config);

    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(1);
    expect(result[0].label).toEqual("my-custom-label");
  });
});
