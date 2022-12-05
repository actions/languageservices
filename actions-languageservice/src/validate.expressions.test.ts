import {DiagnosticSeverity} from "vscode-languageserver-types";
import {createDocument} from "./test-utils/document";
import {validate} from "./validate";

describe("expression validation", () => {
  it("access invalid context field", async () => {
    const result = await validate(
      createDocument(
        "wf.yaml",
        `on: push
run-name: name-\${{ github.does-not-exist }}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo`
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

  describe("expressions without markers", () => {
    it("access invalid context field", async () => {
      const result = await validate(
        createDocument(
          "wf.yaml",
          `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo
        if: github.does-not-exist`
        )
      );

      expect(result).toEqual([
        {
          message: "Context access might be invalid: does-not-exist",
          range: {
            start: {
              character: 12,
              line: 6
            },
            end: {
              character: 33,
              line: 6
            }
          },
          severity: DiagnosticSeverity.Warning
        }
      ]);
    });
  });

  describe("steps context", () => {
    it("steps.<step_id>", async () => {
      const input = `
  on: push
  jobs:
    a:
      runs-on: ubuntu-latest
      steps:
      - id: a
        run: echo hello a
      - id: b
        run: echo \${{ steps.a }}
  `;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });

    it("steps.<step_id>.outputs.<output_id>", async () => {
      const input = `
      on: push
      jobs:
        a:
          runs-on: ubuntu-latest
          steps:
          - id: a
            run: echo hello a
          - id: b
            run: echo \${{ steps.a.outputs.anything }}
      `;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });

    it("invalid reference of later step", async () => {
      const input = `
      on: push
      jobs:
        a:
          runs-on: ubuntu-latest
          steps:
          - id: a
            run: echo hello a
          - id: b
            run: echo \${{ steps.c }}
          - id: c
            run: echo hello c
      `;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Context access might be invalid: c",
          range: {
            end: {
              character: 36,
              line: 9
            },
            start: {
              character: 22,
              line: 9
            }
          },
          severity: DiagnosticSeverity.Warning
        }
      ]);
    });

    it("invalid reference of generated step name", async () => {
      const input = `
      on: push
      jobs:
        a:
          runs-on: ubuntu-latest
          steps:
          - id: a
            run: echo hello a
          - id: b
            run: echo \${{ steps.__run }}
      `;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Context access might be invalid: __run",
          range: {
            end: {
              character: 40,
              line: 9
            },
            start: {
              character: 22,
              line: 9
            }
          },
          severity: DiagnosticSeverity.Warning
        }
      ]);
    });
  });
});
