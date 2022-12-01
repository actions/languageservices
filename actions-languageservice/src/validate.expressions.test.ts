import {DiagnosticSeverity} from "vscode-languageserver-types";
import {createDocument} from "./test-utils/document";
import {validate} from "./validate";

describe("expression validation", () => {
  it("access invalid context field", async () => {
    const result = await validate(
      createDocument(
        "wf.yaml",
        "on: push\nrun-name: name-${{ github.does-not-exist }}\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n    - run: echo"
      )
    );

    expect(result).toEqual([
      {
        message: "Context access might be invalid: does-not-exist",
        range: {
          end: {
            character: 43,
            line: 1
          },
          start: {
            character: 15,
            line: 1
          }
        },
        severity: DiagnosticSeverity.Warning
      }
    ]);
  });

  it("access invalid nested context field", async () => {
    const result = await validate(
      createDocument(
        "wf.yaml",
        "on: push\nrun-name: name-${{ github.does-not-exist.again }}\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n    - run: echo"
      )
    );

    expect(result).toEqual([
      {
        message: "Context access might be invalid: does-not-exist",
        range: {
          end: {
            character: 49,
            line: 1
          },
          start: {
            character: 15,
            line: 1
          }
        },
        severity: DiagnosticSeverity.Warning
      }
    ]);
  });

  it("needs.<job_id>", async () => {
    const input = `
on: push
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
    - run: echo hello a
  b:
    needs: [a]
    runs-on: ubuntu-latest
    steps:
    - run: echo "hello \${{ needs.a }}"
`;
    const result = await validate(createDocument("wf.yaml", input));

    expect(result).toEqual([]);
  });
});
