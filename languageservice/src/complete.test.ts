/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {MarkupContent, TextEdit} from "vscode-languageserver-types";
import {complete} from "./complete.js";
import {registerLogger} from "./log.js";
import {getPositionFromCursor} from "./test-utils/cursor-position.js";
import {TestLogger} from "./test-utils/logger.js";
import {clearCache} from "./utils/workflow-cache.js";
import {ValueProviderConfig, ValueProviderKind} from "./value-providers/config.js";

registerLogger(new TestLogger());

beforeEach(() => {
  clearCache();
});

describe("completion", () => {
  it("runs-on", async () => {
    const input = "on: push\njobs:\n  build:\n    runs-on: |";
    const result = await complete(...getPositionFromCursor(input));

    expect(result).not.toBeUndefined();
    // 28 runner labels + 2 escape hatches (switch to list, switch to full syntax)
    expect(result.length).toEqual(30);
    const labels = result.map(x => x.label);
    expect(labels).toContain("macos-latest");
    expect(labels).toContain("(switch to list)");
    expect(labels).toContain("(switch to mapping)");
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
    expect(result.length).toEqual(13);
    expect(result[0].label).toEqual("concurrency");
  });

  it("completion within a sequence", async () => {
    const input = `on: push
jobs:
  build:
    runs-on: [ubuntu-latest, u|]`;
    const result = await complete(...getPositionFromCursor(input));

    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(27);

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
    expect(result.length).toEqual(30);
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
    // Expect string values plus escape hatch to switch to list form
    expect(result.map(x => x.label)).toEqual([
      "created",
      "deleted",
      "edited",
      "prereleased",
      "published",
      "released",
      "unpublished",
      "(switch to list)"
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
    // Custom value plus escape hatches for list and full syntax
    expect(result.length).toEqual(3);
    expect(result[0].label).toEqual("my-custom-label");
    expect(result.map(x => x.label)).toContain("(switch to list)");
    expect(result.map(x => x.label)).toContain("(switch to mapping)");
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

  it("does not show mapping keys or parent sibling keys in Key mode", async () => {
    // At `container: |`, the scalar form is a string with no constants.
    // Mapping keys should NOT be shown inline - but escape hatch to full syntax IS shown.
    const input = `on: push
jobs:
  build:
    container: |
    runs-on: ubuntu-latest`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    // Only escape hatch to full syntax (container has mapping form but no sequence)
    expect(result.map(x => x.label)).toEqual(["(switch to mapping)"]);
  });

  it("does not show mapping keys in Key mode when structure is uncommitted", async () => {
    // At `concurrency: |`, user is in Key mode but hasn't committed to a structure.
    // The scalar form is a string with no constants, so no scalar completions.
    // But escape hatch to full syntax IS shown as a way out.
    const input = `on: push
jobs:
  build:
    concurrency: |`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result.map(x => x.label)).toEqual(["(switch to mapping)"]);
  });

  it("job key", async () => {
    const input = `on: push
jobs:
  build:
    runs-|`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result).toHaveLength(30);
  });

  it("job key with comment afterwards", async () => {
    const input = `on: push
jobs:
  build:
    runs-|
  #`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result).toHaveLength(30);
  });

  it("job key with other values afterwards", async () => {
    const input = `on: push
jobs:
  build:
    runs-|

    concurrency: 'group-name'`;
    const result = await complete(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    // Verify we get job-level completions, but concurrency is already present so excluded
    expect(result.length).toBeGreaterThan(20);
    expect(result.some(x => x.label === "runs-on")).toBe(true);
    expect(result.some(x => x.label === "concurrency")).toBe(false);
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
    // Verify we get job-level completions including runs-on variants
    expect(result.length).toBeGreaterThan(20);
    expect(result.some(x => x.label === "steps")).toBe(true);
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
    // Verify we get job-level completions
    expect(result.length).toBeGreaterThan(20);
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

      // One-of (scalar variant)
      const concurrencyScalar = result.find(x => x.label === "concurrency" && x.labelDetails === undefined);
      expect(concurrencyScalar?.textEdit?.newText).toEqual("concurrency: ");
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

      // One-of (scalar variant)
      const concurrencyScalar = result.find(x => x.label === "concurrency" && x.labelDetails === undefined);
      expect(concurrencyScalar?.textEdit?.newText).toEqual("concurrency: ");
    });
  });

  it("does not show mapping keys in Key mode for one-of with mapping variant", async () => {
    // At `concurrency: |`, mapping keys should NOT be shown.
    // Users who want the mapping form should use `concurrency (full syntax)` at parent level.
    const input = "concurrency: |";

    const result = await complete(...getPositionFromCursor(input));

    expect(result.filter(x => x.label === "cancel-in-progress")).toEqual([]);
    expect(result.filter(x => x.label === "group")).toEqual([]);
  });

  it("does not add new line if no key in line", async () => {
    const input = "run-n|";

    const result = await complete(...getPositionFromCursor(input));

    expect(result.filter(x => x.label === "run-name").map(x => x.textEdit?.newText)).toEqual(["run-name: "]);
  });

  it("does not show mapping keys when user has started typing a scalar value", async () => {
    // User typed `workflow_dispatch: in` - they've committed to a scalar value
    // Should not show mapping keys like `inputs`
    const input = "on:\n  workflow_dispatch: in|";

    const result = await complete(...getPositionFromCursor(input));

    // No mapping keys should be shown since user started typing a scalar
    expect(result.filter(x => x.label === "inputs")).toEqual([]);
  });

  it("adds : for one-of", async () => {
    const input = "on:\n  check_run:\n    ty|";

    const result = await complete(...getPositionFromCursor(input));

    // Scalar variant inserts "types: "
    const scalarVariant = result.find(x => x.label === "types" && x.labelDetails === undefined);
    expect(scalarVariant?.textEdit?.newText).toEqual("types: ");
  });

  it("does not show mapping keys for one-of when user has typed a scalar value", async () => {
    // User typed `check_run: ty` - they've committed to scalar form
    // The only valid value for check_run scalar is null, so no completions
    const input = "on:\n  check_run: ty|";

    const result = await complete(...getPositionFromCursor(input));

    // check_run's scalar form only accepts null, so typing anything should show no completions
    // (we don't show mapping keys like `types` anymore - user should use check_run with detail "full syntax" instead)
    expect(result.filter(x => x.label === "types")).toEqual([]);
  });

  it("shows only scalar options for one-of in Key mode when user hasn't committed to a type", async () => {
    // At `permissions: |` user hasn't typed anything yet - show only scalar options
    // Mapping keys are NOT shown because they would require a newline
    // Users who want the mapping form can use `permissions (full syntax)` at the parent level
    const input = "on: push\npermissions: |";

    const result = await complete(...getPositionFromCursor(input));

    // String values (read-all, write-all) should be available
    expect(result.filter(x => x.label === "read-all").map(x => x.textEdit?.newText)).toEqual(["read-all"]);
    expect(result.filter(x => x.label === "write-all").map(x => x.textEdit?.newText)).toEqual(["write-all"]);

    // Mapping keys should NOT be shown - they require a newline which is confusing inline
    expect(result.filter(x => x.label === "actions")).toEqual([]);
    expect(result.filter(x => x.label === "contents")).toEqual([]);
  });

  it("filters to scalar options when user has started typing a scalar", async () => {
    // User typed `permissions: r` - they've committed to scalar form
    const input = "on: push\npermissions: r|";

    const result = await complete(...getPositionFromCursor(input));

    // Only scalar values should be shown (filtering on 'r')
    expect(result.some(x => x.label === "read-all")).toBe(true);
    // Mapping keys should NOT be shown
    expect(result.filter(x => x.label === "actions")).toEqual([]);
    expect(result.filter(x => x.label === "contents")).toEqual([]);
  });

  it("shows both simple and full syntax for null+mapping one-of", async () => {
    // check_run is a one-of: [null, mapping]. Show both:
    // - check_run (simple, just the key with colon)
    // - check_run with detail "full syntax" (ready to add mapping keys)
    const input = "on:\n  |";

    const result = await complete(...getPositionFromCursor(input));

    // Should have both check_run (scalar) and check_run with detail "full syntax"
    const checkRunVariants = result.filter(x => x.label === "check_run");
    expect(checkRunVariants.some(x => x.labelDetails === undefined)).toBe(true);
    expect(checkRunVariants.some(x => x.labelDetails?.description === "full syntax")).toBe(true);
  });

  it("shows all three variants for scalar+sequence+mapping one-of", async () => {
    // runs-on is a one-of: [string, sequence, mapping]
    const input = `on: push
jobs:
  build:
    |`;

    const result = await complete(...getPositionFromCursor(input));

    // Should have runs-on (scalar), runs-on with detail "list", and runs-on with detail "full syntax"
    const runsOnVariants = result.filter(x => x.label === "runs-on");
    expect(runsOnVariants.length).toBe(3);
    expect(runsOnVariants.some(x => x.labelDetails === undefined)).toBe(true);
    expect(runsOnVariants.some(x => x.labelDetails?.description === "list")).toBe(true);
    expect(runsOnVariants.some(x => x.labelDetails?.description === "full syntax")).toBe(true);
  });

  it("generates correct insertText for one-of variants in parent mode", async () => {
    // runs-on is a one-of: [string, sequence, mapping]
    const input = `on: push
jobs:
  build:
    |`;

    const result = await complete(...getPositionFromCursor(input));

    const runsOnVariants = result.filter(x => x.label === "runs-on");

    // Scalar: just key with colon and space
    expect(runsOnVariants.find(x => x.labelDetails === undefined)?.textEdit?.newText).toEqual("runs-on: ");

    // Sequence: key with colon, newline, and list item
    expect(runsOnVariants.find(x => x.labelDetails?.description === "list")?.textEdit?.newText).toEqual(
      "runs-on:\n  - "
    );

    // Mapping: key with colon, newline, and indentation for nested keys
    expect(runsOnVariants.find(x => x.labelDetails?.description === "full syntax")?.textEdit?.newText).toEqual(
      "runs-on:\n  "
    );
  });

  it("generates correct insertText for one-of variants in parent mode", async () => {
    // concurrency is a one-of: [string, mapping] - testing parent mode (inside mapping)
    // At `concurrency:\n  |`, user HAS committed to mapping structure, so mapping keys are shown
    const input = "concurrency:\n  |";

    const result = await complete(...getPositionFromCursor(input));

    // In parent mode: just key + colon + space (no leading newline)
    expect(result.find(x => x.label === "group")?.textEdit?.newText).toEqual("group: ");

    // Boolean in parent mode (cancel-in-progress): key + colon + space
    expect(result.find(x => x.label === "cancel-in-progress")?.textEdit?.newText).toEqual("cancel-in-progress: ");
  });

  it("uses sortText for ordering qualified one-of variants", async () => {
    // runs-on has multiple structural types, so variants need sorting
    const input = `on: push
jobs:
  build:
    |`;

    const result = await complete(...getPositionFromCursor(input));

    const runsOnVariants = result.filter(x => x.label === "runs-on");

    // Scalar: no sortText needed (sorts naturally first)
    expect(runsOnVariants.find(x => x.labelDetails === undefined)?.sortText).toBeUndefined();

    // Sequence and mapping: sortText controls ordering
    expect(runsOnVariants.find(x => x.labelDetails?.description === "list")?.sortText).toEqual("runs-on 1");
    expect(runsOnVariants.find(x => x.labelDetails?.description === "full syntax")?.sortText).toEqual("runs-on 2");
  });

  it("scalar event completion inserts inline without newline", async () => {
    // At `on: |` user is completing the value for 'on' key
    // Scalar events like `push`, `check_run` should insert inline
    const input = "on: |";

    const result = await complete(...getPositionFromCursor(input));

    // Scalar forms should NOT have newline - they insert inline
    const push = result.find(x => x.label === "push");
    expect(push?.textEdit?.newText).toEqual("push");

    const checkRun = result.find(x => x.label === "check_run" && x.labelDetails === undefined);
    expect(checkRun?.textEdit?.newText).toEqual("check_run");

    // Full syntax form should NOT be shown in Key mode - it requires a newline
    // which is confusing when typing inline. Users who want the mapping form
    // can use `on (full syntax)` at the parent level.
    expect(result.find(x => x.label === "check_run" && x.labelDetails?.description === "full syntax")).toBeUndefined();
  });

  it("filters to sequence options when user has started a sequence", async () => {
    // User started a sequence with `- ` syntax - they've committed to sequence form
    const input = `on: push
jobs:
  build:
    runs-on:
      - |`;

    const result = await complete(...getPositionFromCursor(input));

    // Should show runner labels (sequence item values)
    expect(result.some(x => x.label === "ubuntu-latest")).toBe(true);
    expect(result.some(x => x.label === "macos-latest")).toBe(true);

    // Should NOT show mapping keys like `group` or `labels` (those are for full syntax)
    expect(result.filter(x => x.label === "group")).toEqual([]);
    expect(result.filter(x => x.label === "labels")).toEqual([]);
  });

  describe("escape hatch completions", () => {
    it("runs-on shows switch to list and full syntax", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: |`;
      const result = await complete(...getPositionFromCursor(input));

      // Should have escape hatches at the end
      const switchToList = result.find(x => x.label === "(switch to list)");
      const switchToFull = result.find(x => x.label === "(switch to mapping)");

      expect(switchToList).toBeDefined();
      expect(switchToFull).toBeDefined();

      // Escape hatches should sort last
      expect(switchToList!.sortText).toEqual("zzz_switch_1");
      expect(switchToFull!.sortText).toEqual("zzz_switch_2");

      // Escape hatches should have textEdit at cursor position (for VS Code filtering compatibility)
      const listEdit = switchToList!.textEdit as TextEdit;
      const fullEdit = switchToFull!.textEdit as TextEdit;

      // Main textEdit inserts newline and indented content at cursor position
      expect(listEdit.newText).toEqual("\n  - ");
      expect(fullEdit.newText).toEqual("\n  ");

      // TextEdit range should be at cursor position (empty range)
      expect(listEdit.range.start).toEqual({line: 3, character: 13});
      expect(listEdit.range.end).toEqual({line: 3, character: 13});
      expect(fullEdit.range.start).toEqual({line: 3, character: 13});
      expect(fullEdit.range.end).toEqual({line: 3, character: 13});

      // additionalTextEdits should clean up the key portion
      expect(switchToList!.additionalTextEdits).toHaveLength(1);
      expect(switchToList!.additionalTextEdits![0].range.start).toEqual({line: 3, character: 4});
      expect(switchToList!.additionalTextEdits![0].range.end).toEqual({line: 3, character: 13});
      expect(switchToList!.additionalTextEdits![0].newText).toEqual("runs-on:");

      expect(switchToFull!.additionalTextEdits).toHaveLength(1);
      expect(switchToFull!.additionalTextEdits![0].newText).toEqual("runs-on:");
    });

    it("permissions shows only switch to full syntax (no sequence form)", async () => {
      const input = `on: push
permissions: |`;
      const result = await complete(...getPositionFromCursor(input));

      // Should have full syntax escape hatch but NOT list (permissions has no sequence form)
      expect(result.some(x => x.label === "(switch to mapping)")).toBe(true);
      expect(result.some(x => x.label === "(switch to list)")).toBe(false);
    });

    it("escape hatches are not shown when value is non-empty", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-|`;
      const result = await complete(...getPositionFromCursor(input));

      // User has started typing a scalar value, no escape hatches
      expect(result.some(x => x.label === "(switch to list)")).toBe(false);
      expect(result.some(x => x.label === "(switch to mapping)")).toBe(false);
    });

    it("escape hatches are not shown when inside a sequence", async () => {
      const input = `on: push
jobs:
  build:
    runs-on:
      - |`;
      const result = await complete(...getPositionFromCursor(input));

      // User is already in sequence form, no escape hatches
      expect(result.some(x => x.label === "(switch to list)")).toBe(false);
      expect(result.some(x => x.label === "(switch to mapping)")).toBe(false);
    });

    it("escape hatches are not shown when inside a mapping", async () => {
      const input = `on: push
jobs:
  build:
    runs-on:
      group: |`;
      const result = await complete(...getPositionFromCursor(input));

      // User is in mapping form completing a value, no escape hatches for the parent
      expect(result.some(x => x.label === "(switch to list)")).toBe(false);
      expect(result.some(x => x.label === "(switch to mapping)")).toBe(false);
    });

    it("escape hatches ARE shown even when no scalar completions exist", async () => {
      // concurrency: | has no scalar constants, but escape hatch provides a way out
      const input = `on: push
jobs:
  build:
    concurrency: |`;
      const result = await complete(...getPositionFromCursor(input));

      // Escape hatch to mapping should be available even with no scalar completions
      expect(result.map(x => x.label)).toEqual(["(switch to mapping)"]);
    });

    it("pure mapping type (strategy) shows switch to mapping", async () => {
      const input = `on: push
jobs:
  build:
    strategy: |`;
      const result = await complete(...getPositionFromCursor(input));

      expect(result.some(x => x.label === "(switch to mapping)")).toBe(true);
    });

    it("pure sequence type (steps) shows switch to list", async () => {
      const input = `on: push
jobs:
  build:
    steps: |`;
      const result = await complete(...getPositionFromCursor(input));

      expect(result.some(x => x.label === "(switch to list)")).toBe(true);
    });

    it("selecting switch to list restructures YAML", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: |`;
      const result = await complete(...getPositionFromCursor(input));

      const switchToList = result.find(x => x.label === "(switch to list)");
      const textEdit = switchToList!.textEdit as TextEdit;
      const additionalEdits = switchToList!.additionalTextEdits!;

      // Main textEdit inserts newline content at cursor
      expect(textEdit.newText).toEqual("\n  - ");

      // additionalTextEdits replaces "runs-on: " with "runs-on:"
      expect(additionalEdits).toHaveLength(1);
      expect(additionalEdits[0].newText).toEqual("runs-on:");

      // Combined result when applied: "runs-on:\n  - "
    });
  });

  describe("runs-on mapping syntax", () => {
    it("provides label completions for labels as scalar", async () => {
      const input = `on: push
jobs:
  build:
    runs-on:
      labels: |`;
      const result = await complete(...getPositionFromCursor(input));

      // Should show runner labels
      expect(result.some(x => x.label === "ubuntu-latest")).toBe(true);
      expect(result.some(x => x.label === "macos-latest")).toBe(true);
      expect(result.some(x => x.label === "self-hosted")).toBe(true);
    });

    it("provides label completions for labels as sequence item", async () => {
      const input = `on: push
jobs:
  build:
    runs-on:
      labels:
        - |`;
      const result = await complete(...getPositionFromCursor(input));

      // Should show runner labels
      expect(result.some(x => x.label === "ubuntu-latest")).toBe(true);
      expect(result.some(x => x.label === "macos-latest")).toBe(true);
      expect(result.some(x => x.label === "self-hosted")).toBe(true);
    });

    it("excludes already used labels in sequence", async () => {
      const input = `on: push
jobs:
  build:
    runs-on:
      labels:
        - ubuntu-latest
        - |`;
      const result = await complete(...getPositionFromCursor(input));

      // Should NOT show ubuntu-latest since it's already in the list
      expect(result.some(x => x.label === "ubuntu-latest")).toBe(false);
      // But should show other labels
      expect(result.some(x => x.label === "macos-latest")).toBe(true);
    });
  });

  describe("expression completions", () => {
    it("includes case function", async () => {
      const input = "on: push\njobs:\n  build:\n    runs-on: ${{ c|";
      const result = await complete(...getPositionFromCursor(input));

      expect(result).not.toBeUndefined();
      // Expression completions starting with 'c': case, contains
      const labels = result.map(x => x.label);
      expect(labels).toContain("case");
      expect(labels).toContain("contains");
    });
  });
});
