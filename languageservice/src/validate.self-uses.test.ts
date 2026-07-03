import {FileProvider} from "@actions/workflow-parser/workflows/file-provider";
import {fileIdentifier} from "@actions/workflow-parser/workflows/file-reference";
import {DiagnosticSeverity} from "vscode-languageserver-types";
import {createDocument} from "./test-utils/document.js";
import {clearCache} from "./utils/workflow-cache.js";
import {validate} from "./validate.js";

beforeEach(() => {
  clearCache();
});

// Resolves self-referenced actions ($/path) against a fake in-repo file system. Only
// `actions/my-action/action.yml` exists.
const selfActionFileProvider: FileProvider = {
  // eslint-disable-next-line @typescript-eslint/require-await
  getFileContent: async ref => {
    switch (fileIdentifier(ref)) {
      case "./actions/my-action/action.yml":
        return {
          name: "actions/my-action/action.yml",
          content: `name: My Action
description: A self-referenced action
runs:
  using: node20
  main: index.js
`
        };

      default:
        throw new Error("File not found");
    }
  }
};

describe("self-reference ($/) action resolution", () => {
  it("valid self-reference resolves to an action.yml", async () => {
    const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: $/actions/my-action
`;
    const result = await validate(createDocument("wf.yaml", input), {
      fileProvider: selfActionFileProvider
    });
    expect(result).toEqual([]);
  });

  it("self-reference to a directory without an action manifest reports an error", async () => {
    const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: $/actions/missing
`;
    const result = await validate(createDocument("wf.yaml", input), {
      fileProvider: selfActionFileProvider
    });
    expect(result).toEqual([
      {
        severity: DiagnosticSeverity.Error,
        range: {
          start: {line: 5, character: 12},
          end: {line: 5, character: 29}
        },
        message:
          "Unable to resolve action `$/actions/missing`, no 'action.yml' or 'action.yaml' found in 'actions/missing'",
        code: "invalid-uses-format"
      }
    ]);
  });

  it("skips the existence check when no fileProvider is configured", async () => {
    const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: $/actions/missing
`;
    const result = await validate(createDocument("wf.yaml", input));
    expect(result).toEqual([]);
  });
});
