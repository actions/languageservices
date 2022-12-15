import {DiagnosticSeverity} from "vscode-languageserver-types";
import {registerLogger} from "./log";
import {createDocument} from "./test-utils/document";
import {TestLogger} from "./test-utils/logger";
import {validate} from "./validate";

registerLogger(new TestLogger());

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

  describe("job context", () => {
    it("job.status", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    container:
      image: node:14.16
    steps:
      - run: echo \${{ job.container }}
      - run: echo \${{ job.container.id }}
      - run: echo \${{ job.container.network }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });

    it("job.status", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ job.status }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });

    it("job.services.<service_id>", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      nginx:
        image: node:14.16
        ports:
          - 80
    steps:
      - run: echo \${{ job.services.nginx }}
      - run: echo \${{ job.services.nginx.id }}
      - run: echo \${{ job.services.nginx.network }}
      - run: echo \${{ job.services.nginx.ports }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });
  });

  describe("strategy context", () => {
    it("reference within a matrix job", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-group: [1, 2]
        node: [14, 16]
    steps:
      - uses: actions/checkout@v3
      - run: echo \${{ strategy.fail-fast }}
      - run: echo \${{ strategy.job-index }}
      - run: echo \${{ strategy.job-total }}
      - run: echo \${{ strategy.max-parallel }}
`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });

    it("reference outside of a matrix job", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: echo \${{ strategy.fail-fast }}
      - run: echo \${{ strategy.job-index }}
      - run: echo \${{ strategy.job-total }}
      - run: echo \${{ strategy.max-parallel }}
`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).not.toEqual([]);
    });

    it("invalid strategy property", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        test-group: [1, 2]
        node: [14, 16]
    steps:
      - uses: actions/checkout@v3
      - run: echo \${{ strategy.fail-faster-than-fast }}
`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Context access might be invalid: fail-faster-than-fast",
          range: {
            end: {
              character: 55,
              line: 12
            },
            start: {
              character: 18,
              line: 12
            }
          },
          severity: DiagnosticSeverity.Warning
        }
      ]);
    });
  });

  describe("multi-line strings", () => {
    it("indented |", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: |
          first line
          test \${{ github.does-not-exist }}
          test2`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Context access might be invalid: does-not-exist",
          range: {
            end: {
              character: 43,
              line: 7
            },
            start: {
              character: 15,
              line: 7
            }
          },
          severity: DiagnosticSeverity.Warning
        }
      ]);
    });

    it("indented |+", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: |+
          first line
          test \${{ github.does-not-exist }}
          test2`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Context access might be invalid: does-not-exist",
          range: {
            end: {
              character: 43,
              line: 7
            },
            start: {
              character: 15,
              line: 7
            }
          },
          severity: DiagnosticSeverity.Warning
        }
      ]);
    });

    it("indented >", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: >
          first line
          test \${{ github.does-not-exist }}
          test2`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Context access might be invalid: does-not-exist",
          range: {
            end: {
              character: 43,
              line: 7
            },
            start: {
              character: 15,
              line: 7
            }
          },
          severity: DiagnosticSeverity.Warning
        }
      ]);
    });

    it("indented >+", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: >+
          first line
          test \${{ github.does-not-exist }}
          test2`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Context access might be invalid: does-not-exist",
          range: {
            end: {
              character: 43,
              line: 7
            },
            start: {
              character: 15,
              line: 7
            }
          },
          severity: DiagnosticSeverity.Warning
        }
      ]);
    });
  });

  describe("matrix context", () => {
    it("reference within a matrix job", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [14, 16]
    steps:
      - uses: actions/checkout@v3
      - run: echo \${{ matrix.node }}
`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });

    it("reference outside of a matrix job", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: echo \${{ matrix.node }}
`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Context access might be invalid: matrix",
          range: {
            end: {
              character: 36,
              line: 8
            },
            start: {
              character: 18,
              line: 8
            }
          },
          severity: DiagnosticSeverity.Warning
        }
      ]);
    });

    it("basic matrix", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: \${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [14, 16]
    steps:
      - uses: actions/checkout@v3
      - run: echo \${{ matrix.node }}
`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });

    it("invalid property reference", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: \${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [14, 16]
        include:
          - os: macos-latest
            node: 14
        exclude:
          - os: windows-latest
            node: 14
    steps:
      - uses: actions/checkout@v3
      - run: echo \${{ matrix.goversion }}
`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Context access might be invalid: goversion",
          range: {
            end: {
              character: 41,
              line: 18
            },
            start: {
              character: 18,
              line: 18
            }
          },
          severity: DiagnosticSeverity.Warning
        }
      ]);
    });

    it("matrix with include", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: \${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [14, 16]
        include:
          - os: macos-latest
            node: 14
    steps:
      - uses: actions/checkout@v3
      - run: echo \${{ matrix.node }}
`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });

    it("matrix with only include", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
          - os: windows-latest
            node: 14
    steps:
      - uses: actions/checkout@v3
      - run: echo \${{ matrix.os }}
      - run: echo \${{ matrix.node }}
`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });

    it("matrix with exclude", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: \${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [14, 16]
        include:
          - os: macos-latest
            node: 14
        exclude:
          - os: windows-latest
            node: 14
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: \${{ matrix.node }}
`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });

    it("matrix with only exclude", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: \${{ matrix.os }}
    strategy:
      matrix:
        exclude:
          - os: windows-latest
            node: 14
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: \${{ matrix.node }}
`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Context access might be invalid: os",
          range: {
            end: {
              character: 29,
              line: 5
            },
            start: {
              character: 13,
              line: 5
            }
          },
          severity: DiagnosticSeverity.Warning
        },
        {
          message: "Context access might be invalid: node",
          range: {
            end: {
              character: 42,
              line: 15
            },
            start: {
              character: 24,
              line: 15
            }
          },
          severity: DiagnosticSeverity.Warning
        }
      ]);
    });

    it("matrix from expression", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix: \${{ fromJSON('{"color":["green","blue"]}') }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: \${{ matrix.ANYVALUE }}
`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });

    it("matrix with include expression", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        fruit: [apple, pear]
        animal: [cat, dog]
        include: \${{ fromJSON('{"color":"green"}') }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: \${{ matrix.ANYVALUE }}
`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });

    it("matrix with property expression", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        color: \${{ fromJSON('["green","blue"]') }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: \${{ matrix.color }}
`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });

    it("matrix with property expression and invalid property reference", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        color: \${{ fromJSON('["green","blue"]') }}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: \${{ matrix.shape }}
`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Context access might be invalid: shape",
          range: {
            end: {
              character: 43,
              line: 13
            },
            start: {
              character: 24,
              line: 13
            }
          },
          severity: DiagnosticSeverity.Warning
        }
      ]);
    });
  });
});
