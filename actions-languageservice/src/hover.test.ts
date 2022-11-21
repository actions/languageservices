import {TextDocument} from "vscode-languageserver-textdocument";
import {hover} from "./hover";

describe("validation", () => {
  it("valid workflow", async () => {
    const input = `on: push
jobs:
  build:
    runs-on: [self-hosted, u|]`;
    const doc = TextDocument.create("test://test/test.yaml", "yaml", 0, input);
    const result = await hover(doc, {
      line: 0,
      character: 0
    });
    expect(result).not.toBeUndefined();
    expect(result?.contents).toEqual(
      "The name of the GitHub event that triggers the workflow. You can provide a single event string, array of events, array of event types, or an event configuration map that schedules a workflow or restricts the execution of a workflow to specific files, tags, or branch changes. For a list of available events, see https://help.github.com/en/github/automating-your-workflow-with-github-actions/events-that-trigger-workflows."
    );
  });

  it("hover on value", async () => {
    const input = `on: push
jobs:
  build:
    runs-on: [self-hosted, u|]`;
    const doc = TextDocument.create("test://test/test.yaml", "yaml", 0, input);
    const result = await hover(doc, {
      line: 0,
      character: 5
    });
    expect(result?.contents).toBeUndefined();
  });
});
