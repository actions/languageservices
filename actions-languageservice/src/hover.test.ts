import {TextDocument} from "vscode-languageserver-textdocument";
import {hover} from "./hover";
import {getPositionFromCursor} from "./test-utils/cursor-position";

describe("hover", () => {
  it("on a key", async () => {
    const input = `o|n: push
jobs:
  build:
    runs-on: [self-hosted]`;
    const result = await hover(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result?.contents).toEqual(
      "The name of the GitHub event that triggers the workflow. You can provide a single event string, array of events, array of event types, or an event configuration map that schedules a workflow or restricts the execution of a workflow to specific files, tags, or branch changes. For a list of available events, see https://help.github.com/en/github/automating-your-workflow-with-github-actions/events-that-trigger-workflows."
    );
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
    expect(result?.contents).toEqual(
      "You can modify the default permissions granted to the GITHUB_TOKEN, adding or removing access as required, so that you only allow the minimum required access."
    );
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
});
