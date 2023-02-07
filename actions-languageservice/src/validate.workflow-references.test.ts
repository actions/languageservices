import {FileProvider} from "@github/actions-workflow-parser/workflows/file-provider";
import {fileIdentifier} from "@github/actions-workflow-parser/workflows/file-reference";
import {createDocument} from "./test-utils/document";
import {validate} from "./validate";

const testFileProvider: FileProvider = {
  getFileContent: async ref => {
    switch (fileIdentifier(ref)) {
      case "monalisa/octocat/workflow.yaml@main":
        return {
          name: "monalisa/octocat/workflow.yaml",
          content: `
on: workflow_call
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
`
        };

      case "monalisa/octocat/.github/workflows/non-reusable-workflow.yaml@main":
        return {
          name: "monalisa/octocat/.github/workflows/non-reusable-workflow.yaml",
          content: `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
`
        };

      case "./reusable-workflow.yaml":
        return {
          name: "reusable-workflow.yaml",
          content: `
on: workflow_call
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
`
        };

      case "./reusable-workflow-with-inputs.yaml":
        return {
          name: "reusable-workflow-with-inputs.yaml",
          content: `
on:
  workflow_call:
    inputs:
      username:
        description: 'A username passed from the caller workflow'
        required: true
        type: string

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
  `
        };

      default:
        throw new Error("File not found");
    }
  }
};

describe("workflow references validation", () => {
  it("invalid workflow reference", async () => {
    const input = `
on: push

jobs:
  build:
    uses: monalisa/octocat/.github/workflows/non-reusable-workflow.yaml@main
`;
    const result = await validate(createDocument("wf.yaml", input), {
      fileProvider: testFileProvider
    });

    expect(result).toEqual([
      {
        message: "workflow_call key is not defined in the referenced workflow.",
        range: {
          start: {
            character: 10,
            line: 5
          },
          end: {
            character: 76,
            line: 5
          }
        }
      }
    ]);
  });

  it("reference to a non-reusable workflow", async () => {
    const input = `
on: push

jobs:
  build:
    uses: monalisa/octocat/workflow.yaml@not-a-branch
`;
    const result = await validate(createDocument("wf.yaml", input), {
      fileProvider: testFileProvider
    });

    expect(result).toEqual([
      {
        message: "Unable to find reusable workflow",
        range: {
          start: {
            character: 10,
            line: 5
          },
          end: {
            character: 53,
            line: 5
          }
        }
      }
    ]);
  });

  it("valid reference to a reusable workflow", async () => {
    const input = `
on: push

jobs:
  build:
    uses: monalisa/octocat/workflow.yaml@main
`;
    const result = await validate(createDocument("wf.yaml", input), {
      fileProvider: testFileProvider
    });

    expect(result).toEqual([]);
  });

  it("valid reference to a local workflow", async () => {
    const input = `
on: push

jobs:
  build:
    uses: ./reusable-workflow.yaml
`;
    const result = await validate(createDocument("wf.yaml", input), {
      fileProvider: testFileProvider
    });

    expect(result).toEqual([]);
  });

  it("workflow reference without required inputs", async () => {
    const input = `
on: push

jobs:
  build:
    uses: ./reusable-workflow-with-inputs.yaml
`;
    const result = await validate(createDocument("wf.yaml", input), {
      fileProvider: testFileProvider
    });

    expect(result).toEqual([
      {
        message: "Input username is required, but not provided while calling.",
        range: {
          start: {
            character: 10,
            line: 5
          },
          end: {
            character: 46,
            line: 5
          }
        }
      }
    ]);
  });

  it("workflow reference with required inputs", async () => {
    const input = `
on: push

jobs:
  build:
    uses: ./reusable-workflow-with-inputs.yaml
    with:
      username: monalisa
`;
    const result = await validate(createDocument("wf.yaml", input), {
      fileProvider: testFileProvider
    });

    expect(result).toEqual([]);
  });
});
