import {isString} from "@github/actions-workflow-parser/.";
import {StringToken} from "@github/actions-workflow-parser/templates/tokens/string-token";
import {DescriptionProvider, hover, HoverConfig} from "./hover";
import {getPositionFromCursor} from "./test-utils/cursor-position";

export function testHoverConfig(tokenValue: string, tokenKey: string, description?: string) {
  return {
    descriptionProvider: {
      getDescription: async (_, token, __) => {
        if (!isString(token)) {
          throw new Error("Test provider only supports string tokens");
        }

        expect((token as StringToken).value).toEqual(tokenValue);
        expect(token.definition!.key).toEqual(tokenKey);

        return description;
      }
    } satisfies DescriptionProvider
  } satisfies HoverConfig;
}

describe("hover", () => {
  it("on a key", async () => {
    const input = `o|n: push
jobs:
  build:
    runs-on: [self-hosted]`;
    const result = await hover(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result?.contents).toContain("The GitHub event that triggers the workflow.");
  });

  it("on a value", async () => {
    const input = `on: pu|sh
jobs:
  build:
    runs-on: [self-hosted]`;
    const result = await hover(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result?.contents).toEqual("Runs your workflow when you push a commit or tag.");
  });

  it("on a parameter with a description", async () => {
    const input = `on: push
jobs:
  build:
    co|ntinue-on-error: false`;
    const result = await hover(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result?.contents).toEqual(
      "Prevents a workflow run from failing when a job fails. Set to true to allow a workflow run to pass when this job fails.\n\n" +
        "**Context:** github, inputs, vars, needs, strategy, matrix"
    );
  });

  it("on a parameter with its own type", async () => {
    const input = `on: push
jobs:
  build:
    pe|rmissions: read-all`;
    const result = await hover(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result?.contents).toContain(
      "You can use `permissions` to modify the default permissions granted to the `GITHUB_TOKEN`"
    );
  });

  it("property values are not overwritten", async () => {
    const input1 = `on: push
jobs:
  build:
    ti|meout-minutes: 10
    cancel-timeout-minutes: 10`;
    const result1 = await hover(...getPositionFromCursor(input1));
    expect(result1).not.toBeUndefined();

    const input2 = `on: push
jobs:
  build:
    timeout-minutes: 10
    ca|ncel-timeout-minutes: 10`;
    const result2 = await hover(...getPositionFromCursor(input2));
    expect(result2).not.toBeUndefined();
    expect(result1?.contents).not.toEqual(result2?.contents);
  });

  it("on a value in a sequence", async () => {
    const input = `on: [pull_request,
      pu|sh]
jobs:
  build:
    runs-on: [self-hosted]`;
    const result = await hover(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result?.contents).toEqual("Runs your workflow when you push a commit or tag.");
  });

  it("on a cron schedule", async () => {
    const input = `on:
  schedule:
    - cron: '0,30 0|,12 * * *'
`;
    const result = await hover(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result?.contents).toEqual(
      "Runs at 0 and 30 minutes past the hour, at 00:00 and 12:00\n\n" +
        "Actions schedules run at most every 5 minutes. " +
        "[Learn more](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#onschedule)"
    );
  });

  it("on a cron mapping key", async () => {
    const input = `on:
  schedule:
    - c|ron: '0 0 * * *'
`;
    const result = await hover(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result?.contents).toEqual("");
  });

  it("on an invalid cron schedule", async () => {
    const input = `on:
  schedule:
    - cron: '0 0 |* * * * *'
`;
    const result = await hover(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result?.contents).toEqual("");
  });

  it("shows context inherited from parent nodes", async () => {
    const input = `
on: push
jobs:
  build:
    runs-on: [self-hosted]
    steps:
      - uses: actions/checkout@v2
        with:
          ref|: main
`;

    const result = await hover(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();

    // The `ref` is a `string` definition and inherits the context from `step-with`
    const expected =
      "**Context:** github, inputs, vars, needs, strategy, matrix, secrets, steps, job, runner, env, hashFiles(1,255)";
    expect(result?.contents).toEqual(expected);
  });
});

describe("hover with description provider", () => {
  it("uses the description provider", async () => {
    const input = `
on: push
jobs:
  build:
    runs-on: [self-hosted]
    steps:
      - uses: actions/checkout@v2
        with:
          ref|: main
`;

    const result = await hover(
      ...getPositionFromCursor(input),
      testHoverConfig("ref", "string", "The branch, tag or SHA to checkout.")
    );
    expect(result).not.toBeUndefined();

    const expected =
      "The branch, tag or SHA to checkout.\n\n" +
      "**Context:** github, inputs, vars, needs, strategy, matrix, secrets, steps, job, runner, env, hashFiles(1,255)";
    expect(result?.contents).toEqual(expected);
  });

  it("falls back to the token description", async () => {
    const input = `
on: push
jobs:
  build:
    runs-on: [self-hosted]
    steps:
      - uses|: actions/checkout@v2
`;

    const result = await hover(...getPositionFromCursor(input), testHoverConfig("uses", "non-empty-string", undefined));
    expect(result).not.toBeUndefined();
    expect(result?.contents).toEqual(
      "Selects an action to run as part of a step in your job. An action is a reusable unit of code. You can use an action defined in the same repository as the workflow, a public repository, or in a published Docker container image."
    );
  });
});
