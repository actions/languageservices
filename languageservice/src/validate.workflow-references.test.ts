import {createDocument} from "./test-utils/document";
import {testFileProvider} from "./test-utils/test-file-provider";
import {validate} from "./validate";

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
    secrets:
      envPAT: pat
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
    secrets:
        envPAT: pat
`;
    const result = await validate(createDocument("wf.yaml", input), {
      fileProvider: testFileProvider
    });

    expect(result).toEqual([]);
  });
});
