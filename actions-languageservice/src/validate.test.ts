import {Diagnostic} from "vscode-languageserver-types";
import {createDocument} from "./test-utils/document";
import {validate} from "./validate";

describe("validation", () => {
  it("valid workflow", async () => {
    const result = await validate(createDocument("wf.yaml", "on: push\njobs:\n  build:\n    runs-on: ubuntu-latest"));

    expect(result.length).toBe(0);
  });

  it("missing jobs key", async () => {
    const result = await validate(createDocument("wf.yaml", "on: push"));

    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      message: "Required property is missing: jobs",
      range: {
        start: {
          line: 0,
          character: 0
        },
        end: {
          line: 0,
          character: 8
        }
      }
    } as Diagnostic);
  });

  it("extraneous key", async () => {
    const result = await validate(
      createDocument(
        "wf.yaml",
        `on: push
unknown-key: foo
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: echo`
      )
    );

    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      message: "Unexpected value 'unknown-key'",
      range: {
        end: {
          character: 11,
          line: 1
        },
        start: {
          character: 0,
          line: 1
        }
      }
    } as Diagnostic);
  });
});
