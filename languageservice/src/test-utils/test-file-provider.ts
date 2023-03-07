import {FileProvider} from "@github/actions-workflow-parser/workflows/file-provider";
import {fileIdentifier} from "@github/actions-workflow-parser/workflows/file-reference";

export const testFileProvider: FileProvider = {
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

      name:
        description: 'An optional name'
        required: false
        type: string
      key:
        type: string
    secrets:
      envPAT:
        required: true
        description: 'A secret for the environment'
      serverPAT:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
  `
        };

      case "./reusable-workflow-with-inputs-no-description.yaml":
        return {
          name: "reusable-workflow-with-inputs.yaml",
          content: `
on:
  workflow_call:
    inputs:
      username:
        required: true
        type: string

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
  `
        };

      case "./reusable-workflow-with-outputs.yaml":
        return {
          name: "reusable-workflow-with-outputs.yaml",
          content: `
on:
  workflow_call:
    outputs:
      build_id:
        description: 'The resulting build ID'
        value: 123

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
