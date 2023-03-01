import {CompletionItem, MarkupContent} from "vscode-languageserver-types";
import {complete} from "./complete";
import {getPositionFromCursor} from "./test-utils/cursor-position";
import {testFileProvider} from "./test-utils/test-file-provider";

function mapResult(result: CompletionItem[]) {
  return result.map(x => {
    return {label: x.label, description: (x.documentation as MarkupContent)?.value};
  });
}

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
        label: "key"
      },
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
        label: "key"
      },
      {
        label: "name",
        description: "An optional name"
      }
    ]);
  });

  it("completes job secrets", async () => {
    const input = `
on: push

jobs:
  build:
    uses: ./reusable-workflow-with-inputs.yaml
    secrets:
      |
`;
    const result = await complete(...getPositionFromCursor(input), {fileProvider: testFileProvider});

    expect(result).not.toBeUndefined();
    // includes inherit since no secrets have been passed in
    expect(mapResult(result)).toEqual([
      {
        label: "envPAT",
        description: "A secret for the environment"
      },
      {
        label: "inherit"
      },
      {
        label: "serverPAT"
      }
    ]);
  });

  it("completes inherit secrets", async () => {
    const input = `
on: push

jobs:
  build:
    uses: ./reusable-workflow-with-inputs.yaml
    secrets: |
`;
    const result = await complete(...getPositionFromCursor(input), {fileProvider: testFileProvider});

    expect(result).not.toBeUndefined();
    expect(mapResult(result)).toContainEqual({label: "inherit"});
  });

  it("filters existing secrets", async () => {
    const input = `
on: push

jobs:
  build:
    uses: ./reusable-workflow-with-inputs.yaml
    secrets:
      envPAT: "myPAT"
      |
`;
    const result = await complete(...getPositionFromCursor(input), {fileProvider: testFileProvider});

    expect(result).not.toBeUndefined();
    expect(mapResult(result)).toEqual([
      {
        label: "serverPAT"
      }
    ]);
  });
});
