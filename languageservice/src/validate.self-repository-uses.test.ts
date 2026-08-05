import {FileProvider} from "@actions/workflow-parser/workflows/file-provider";
import {fileIdentifier} from "@actions/workflow-parser/workflows/file-reference";
import {DiagnosticSeverity} from "vscode-languageserver-types";
import {createDocument} from "./test-utils/document.js";
import {clearCache} from "./utils/workflow-cache.js";
import {validate} from "./validate.js";

beforeEach(() => {
  clearCache();
});

// Resolves self repository actions ($/path) against a fake in-repo file system.
const selfActionFileProvider: FileProvider = {
  // eslint-disable-next-line @typescript-eslint/require-await
  getFileContent: async ref => {
    switch (fileIdentifier(ref)) {
      case "./actions/my-action/action.yml":
        return {
          name: "actions/my-action/action.yml",
          content: `name: My Action
description: A self repository action
runs:
  using: node20
  main: index.js
`
        };

      case "./actions/action-with-inputs/action.yml":
        return {
          name: "actions/action-with-inputs/action.yml",
          content: `name: Action with inputs
description: A self repository action with inputs
inputs:
  required-input:
    description: A required input
    required: true
  optional-input:
    description: An optional input
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

describe("self repository ($/) action resolution", () => {
  it("valid self repository reference resolves to an action.yml", async () => {
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

  it("validates inputs from the self repository action metadata", async () => {
    const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: $/actions/action-with-inputs
      with:
        unknown-input: value
        required-input: value
`;
    const result = await validate(createDocument("wf.yaml", input), {
      fileProvider: selfActionFileProvider
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      severity: DiagnosticSeverity.Error,
      message: "Invalid action input 'unknown-input'"
    });
  });

  it("reports required inputs from the self repository action metadata", async () => {
    const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: $/actions/action-with-inputs
`;
    const result = await validate(createDocument("wf.yaml", input), {
      fileProvider: selfActionFileProvider
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      severity: DiagnosticSeverity.Error,
      message: "Missing required input `required-input`",
      code: "missing-required-inputs",
      data: {
        missingInputs: [{name: "required-input"}]
      }
    });
  });

  it("self repository reference to a directory without an action manifest reports an error", async () => {
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
