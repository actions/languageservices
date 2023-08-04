/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {MarkupContent, TextEdit} from "vscode-languageserver-types";
import {complete} from "./complete";
import {registerLogger} from "./log";
import {getPositionFromCursor} from "./test-utils/cursor-position";
import {TestLogger} from "./test-utils/logger";
import {clearCache} from "./utils/workflow-cache";
import {ValueProviderConfig, ValueProviderKind} from "./value-providers/config";

registerLogger(new TestLogger());

beforeEach(() => {
  clearCache();
});

describe("completion", () => {
  it("runs-on", async () => {
    const input = "on: push\njobs:\n  build:\n    runs-on: |";
    const result = await complete(...getPositionFromCursor(input));

    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(12);
    const labels = result.map(x => x.label);
    expect(labels).toContain("macos-latest");
  });

  it("needs", async () => {
    const input = `on: push
jobs:
  build:
      runs-on: ubuntu-latest
  build2:
      runs-on: ubuntu-latest
      needs: bu|`;
    const result = await complete(...getPositionFromCursor(input));

    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(1);
    expect(result[0].label).toEqual("build");
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
    runs-on: [ubuntu-latest, u|]`;
    const result = await complete(...getPositionFromCursor(input));

    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(11);

    const labels = result.map(x => x.label);
    expect(labels).toContain("macos-latest");
    expect(labels).not.toContain("ubuntu-latest");
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

  it("string definition completion in sequence", async () => {
    const input = `on:
  release:
    types:
      - |`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result.map(x => x.label)).toEqual([
      "created",
      "deleted",
      "edited",
      "prereleased",
      "published",
      "released",
      "unpublished"
    ]);
  });

  it("string definition completion", async () => {
    const input = `on:
  release:
    types: |`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result.map(x => x.label)).toEqual([
      "created",
      "deleted",
      "edited",
      "prereleased",
      "published",
      "released",
      "unpublished"
    ]);
  });

  it("map keys filter out existing values", async () => {
    const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    |`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result.map(x => x.label)).not.toContain("runs-on");
  });

  it("one-of narrows down to a specific type", async () => {
    // A job could be a job-factory or a workflow-job (callable workflow with uses)
    // If we have `runs-on`, we should be able to identify that we're in a job-factory
    const jobFactory = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    |`;
    const jobFactoryResult = await complete(...getPositionFromCursor(jobFactory));
    expect(jobFactoryResult).not.toBeUndefined();
    expect(jobFactoryResult.map(x => x.label)).not.toContain("uses");

    const workflowJob = `on: push
    jobs:
      build:
        uses: octo-org/this-repo/.github/workflows/workflow-1.yml@172239021f7ba04fe7327647b213799853a9eb89
        |`;
    const workflowJobResult = await complete(...getPositionFromCursor(workflowJob));
    expect(workflowJobResult).not.toBeUndefined();
    expect(workflowJobResult.map(x => x.label)).not.toContain("runs-on");
  });

  it("completes boolean values", async () => {
    const input = `on: push
jobs:
  build:
    continue-on-error: t|`;
    const result = await complete(...getPositionFromCursor(input));

    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(2);

    expect(result.map(x => x.label).sort()).toEqual(["false", "true"]);
  });

  it("completes for empty map values", async () => {
    const input = `on: push
jobs:
  build:
    continue-on-error: |`;
    const result = await complete(...getPositionFromCursor(input));

    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(2);

    expect(result.map(x => x.label).sort()).toEqual(["false", "true"]);
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

    const config: ValueProviderConfig = {
      "runs-on": {
        kind: ValueProviderKind.SuggestedValues,
        get: () => {
          return Promise.resolve([{label: "my-custom-label"}]);
        }
      }
    };
    const result = await complete(...getPositionFromCursor(input), {valueProviderConfig: config});

    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(1);
    expect(result[0].label).toEqual("my-custom-label");
  });

  it("custom value providers for sequences", async () => {
    const input = "on: push\njobs:\n  build:\n    runs-on: [m|]";

    const config: ValueProviderConfig = {
      "runs-on": {
        kind: ValueProviderKind.SuggestedValues,
        get: () => {
          return Promise.resolve([{label: "my-custom-label"}]);
        }
      }
    };
    const result = await complete(...getPositionFromCursor(input), {valueProviderConfig: config});

    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(1);
    expect(result[0].label).toEqual("my-custom-label");
  });

  it("does not show parent mapping sibling keys", async () => {
    const input = `on: push
jobs:
  build:
    container: |
    runs-on: ubuntu-latest`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(6);
    // Should not contain other top-level job keys like `if` and `runs-on`
    expect(result.map(x => x.label)).not.toContain("if");
    expect(result.map(x => x.label)).not.toContain("runs-on");
  });

  it("shows mapping keys within a new map ", async () => {
    const input = `on: push
jobs:
  build:
    concurrency: |`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result.map(x => x.label).sort()).toEqual(["cancel-in-progress", "group"]);
  });

  it("job key", async () => {
    const input = `on: push
jobs:
  build:
    runs-|`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result).toHaveLength(20);
  });

  it("job key with comment afterwards", async () => {
    const input = `on: push
jobs:
  build:
    runs-|
  #`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result).toHaveLength(20);
  });

  it("job key with other values afterwards", async () => {
    const input = `on: push
jobs:
  build:
    runs-|

    concurrency: 'group-name'`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result).toHaveLength(19);
  });

  it("step key without space after colon", async () => {
    const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - env:|
      run: echo`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result).toHaveLength(0);
  });

  it("empty step", async () => {
    const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: echo
    - |`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result).toHaveLength(11);
    expect(result.map(x => x.label)).toEqual([
      "continue-on-error",
      "env",
      "id",
      "if",
      "name",
      "run",
      "shell",
      "timeout-minutes",
      "uses",
      "with",
      "working-directory"
    ]);

    // Includes detail when available. Using continue-on-error as a sample here.
    expect(result.map(x => (x.documentation as MarkupContent)?.value)).toContain(
      "Prevents a job from failing when a step fails. Set to `true` to allow a job to pass when this step fails."
    );
  });

  it("loose mapping keys have no completion suggestions", async () => {
    const input = `
on:
  workflow_dispatch:
    inputs:
      name:
        type: string
        description: "hello"
      |
`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result).toHaveLength(0);
  });

  it("null strings still give suggestions", async () => {
    const input = `
on: push
jobs:
  one:
    runs-on: ubuntu-latest
    |:
    - uses: actions/checkout@v2
`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result).toHaveLength(16);
  });

  it("complete from behind a colon will replace it", async () => {
    const input = `
on: push
jobs:
  one:
    runs-on: ubuntu-latest
    |:
    - uses: actions/checkout@v2
`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result).toHaveLength(16);
    const textEdit = result[0].textEdit as TextEdit;
    expect(textEdit.range).toEqual({
      start: {line: 5, character: 4},
      end: {line: 5, character: 5}
    });
  });

  it("well known mapping keys have descriptions", async () => {
    const input = `
o|
`;
    const result = await complete(...getPositionFromCursor(input));
    const onResult = result.find(x => x.label === "on");
    expect(onResult).not.toBeUndefined();
    expect((onResult!.documentation as MarkupContent).value).toContain("The GitHub event that triggers the workflow.");
  });

  it("event list includes descriptions when available ", async () => {
    const input = `
    on: [check_run, |]`;
    const result = await complete(...getPositionFromCursor(input));
    const dispatchResult = result.find(x => x.label === "workflow_dispatch");
    expect(dispatchResult).not.toBeUndefined();
    expect((dispatchResult!.documentation as MarkupContent).value).toContain(
      "The `workflow_dispatch` event allows you to manually trigger a workflow run."
    );
  });

  it("sets range when completing token", async () => {
    const input = `on: push
jobs:
  pre-build:
    runs-on: ubuntu-latest
  build:
    runs-on: ubuntu-latest
    needs: pre-bu|`;

    const result = await complete(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(1);

    const textEdit = result[0].textEdit as TextEdit;
    expect(textEdit.newText).toEqual("pre-build");
    expect(textEdit.range).toEqual({
      start: {line: 6, character: 11},
      end: {line: 6, character: 17}
    });
  });

  it("sets a range for token key", async () => {
    const input = "on: push\njobs:\n  build:\n    runs-o|";
    const result = await complete(...getPositionFromCursor(input));

    expect(result).not.toBeUndefined();
    expect(result.map(e => e.label)).toContain("runs-on");

    const textEdit = result.filter(e => e.label === "runs-on")[0].textEdit as TextEdit;
    expect(textEdit.newText).toEqual("runs-on: ");
    expect(textEdit.range).toEqual({
      start: {line: 3, character: 4},
      end: {line: 3, character: 10}
    });
  });

  it("sets a 0-length range while no initial token key", async () => {
    const input = "on: push\njobs:\n  build:\n    |";
    const result = await complete(...getPositionFromCursor(input));

    expect(result).not.toBeUndefined();
    expect(result.map(e => e.label)).toContain("runs-on");

    const textEdit = result.filter(e => e.label === "runs-on")[0].textEdit as TextEdit;
    expect(textEdit.newText).toEqual("runs-on: ");
    expect(textEdit.range).toEqual({
      start: {line: 3, character: 4},
      end: {line: 3, character: 4}
    });
  });

  describe("completes with indentation", () => {
    it("default indentation", async () => {
      const input = `on: push
jobs:
  build:
    step|`;
      const result = await complete(...getPositionFromCursor(input));

      // Sequence
      expect(result.filter(x => x.label === "steps").map(x => x.textEdit?.newText)).toEqual(["steps:\n  - "]);

      // Mapping
      expect(result.filter(x => x.label === "env").map(x => x.textEdit?.newText)).toEqual(["env:\n  "]);

      // Value
      expect(result.filter(x => x.label === "timeout-minutes").map(x => x.textEdit?.newText)).toEqual([
        "timeout-minutes: "
      ]);

      // One-of
      expect(result.filter(x => x.label === "concurrency").map(x => x.textEdit?.newText)).toEqual(["concurrency: "]);
    });

    it("custom indentation", async () => {
      // Use 3 spaces to indent
      const input = `on: push
jobs:
   build:
      step|`;
      const result = await complete(...getPositionFromCursor(input));

      // Sequence
      expect(result.filter(x => x.label === "steps").map(x => x.textEdit?.newText)).toEqual(["steps:\n   - "]);

      // Mapping
      expect(result.filter(x => x.label === "env").map(x => x.textEdit?.newText)).toEqual(["env:\n   "]);

      // Value
      expect(result.filter(x => x.label === "timeout-minutes").map(x => x.textEdit?.newText)).toEqual([
        "timeout-minutes: "
      ]);

      // One-of
      expect(result.filter(x => x.label === "concurrency").map(x => x.textEdit?.newText)).toEqual(["concurrency: "]);
    });
  });

  it("adds a new line and indentation for mapping keys when the key is given", async () => {
    const input = "concurrency: |";

    const result = await complete(...getPositionFromCursor(input));

    expect(result.filter(x => x.label === "cancel-in-progress").map(x => x.textEdit?.newText)).toEqual([
      "\n  cancel-in-progress: "
    ]);
    expect(result.filter(x => x.label === "group").map(x => x.textEdit?.newText)).toEqual(["\n  group: "]);
  });

  it("does not add new line if no key in line", async () => {
    const input = "run-n|";

    const result = await complete(...getPositionFromCursor(input));

    expect(result.filter(x => x.label === "run-name").map(x => x.textEdit?.newText)).toEqual(["run-name: "]);
  });

  it("adds new line for nested mapping", async () => {
    const input = "on:\n  workflow_dispatch: in|";

    const result = await complete(...getPositionFromCursor(input));

    expect(result.filter(x => x.label === "inputs").map(x => x.textEdit?.newText)).toEqual(["\n  inputs:\n    "]);
  });

  it("adds : for one-of", async () => {
    const input = "on:\n  check_run:\n    ty|";

    const result = await complete(...getPositionFromCursor(input));

    expect(result.filter(x => x.label === "types").map(x => x.textEdit?.newText)).toEqual(["types: "]);
  });

  it("does not add : for one-of in key mode", async () => {
    const input = "on:\n  check_run: ty|";

    const result = await complete(...getPositionFromCursor(input));

    expect(result.filter(x => x.label === "types").map(x => x.textEdit?.newText)).toEqual(["types"]);
  });
});
