import {CompletionItem, MarkupContent} from "vscode-languageserver-types";
import {complete} from "./complete";
import {getPositionFromCursor} from "./test-utils/cursor-position";
import {testFileProvider} from "./test-utils/test-file-provider";
import { clearParsedCache, clearWorkflowTemplateCache } from "./utils/workflow-cache";

function mapResult(result: CompletionItem[]) {
  return result.map(x => {
    return {label: x.label, description: (x.documentation as MarkupContent).value};
  });
}

beforeEach(() => {
  clearWorkflowTemplateCache();
  clearParsedCache();
});

describe("completion with reusable workflows", () => {
  it("completes job inputs", async () => {
    const input = `
on: push

jobs:
  build:
    uses: ./reusable-workflow-with-inputs.yaml
    with:
      |
`;
    const result = await complete(...getPositionFromCursor(input), {fileProvider: testFileProvider});

    expect(result).not.toBeUndefined();
    expect(mapResult(result)).toEqual([
      {
        label: "name",
        description: "An optional name"
      },
      {
        label: "username",
        description: "A username passed from the caller workflow"
      }
    ]);
  });

  it("filters out existing job inputs", async () => {
    const input = `
on: push

jobs:
  build:
    uses: ./reusable-workflow-with-inputs.yaml
    with:
      username: monalisa
      |
`;
    const result = await complete(...getPositionFromCursor(input), {fileProvider: testFileProvider});

    expect(result).not.toBeUndefined();
    expect(mapResult(result)).toEqual([
      {
        label: "name",
        description: "An optional name"
      }
    ]);
  });
});
