import {DescriptionDictionary} from "@actions/expressions";
import {DiagnosticSeverity} from "vscode-languageserver-types";
import {ContextProviderConfig} from "./context-providers/config.js";
import {registerLogger} from "./log.js";
import {createDocument} from "./test-utils/document.js";
import {TestLogger} from "./test-utils/logger.js";
import {clearCache} from "./utils/workflow-cache.js";
import {validate, ValidationConfig} from "./validate.js";

registerLogger(new TestLogger());

beforeEach(() => {
  clearCache();
});

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

  it("access invalid context field in short-circuited expression", async () => {
    const result = await validate(
      createDocument(
        "wf.yaml",
        `on: push
run-name: name-\${{ github.does-not-exist || github.does-not-exist2 }}
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
            character: 69,
            line: 1
          },
          start: {
            character: 15,
            line: 1
          }
        },
        severity: DiagnosticSeverity.Warning
      },
      {
        message: "Context access might be invalid: does-not-exist2",
        range: {
          end: {
            character: 69,
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

  it("partial skip access invalid context on incomplete", async () => {
    const contextProviderConfig: ContextProviderConfig = {
      getContext: (context: string) => {
        switch (context) {
          case "secrets": {
            const dict = new DescriptionDictionary();
            dict.complete = false;
            return Promise.resolve(dict);
          }
        }

        return Promise.resolve(undefined);
      }
    };

    const validationConfig: ValidationConfig = {
      contextProviderConfig: contextProviderConfig
    };

    const result = await validate(
      createDocument(
        "wf.yaml",
        `on: push
run-name: name-\${{ github.does-not-exist }}
env:
  secret: \${{ secrets.secret-not-exist }}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo`
      ),
      validationConfig
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

  it("no secret validation with workflow_call", async () => {
    const input = `
on:
  workflow_call:
    secrets:
      my_secret:
env:
  my_secret: \${{ secrets.my_secret }}
  secret: \${{ secrets.secret-not-exist }}
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo`;

    const result = await validate(createDocument("wf.yaml", input));
    expect(result).toEqual([]);
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

    it("reference of invalid step in job outputs", async () => {
      const input = `
      on: push
      jobs:
        a:
          outputs:
            environment: \${{ steps.foo }}
          runs-on: ubuntu-latest
          steps:
            - id: a
              run: echo hello a
      `;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Context access might be invalid: foo",
          range: {
            end: {
              character: 41,
              line: 5
            },
            start: {
              character: 25,
              line: 5
            }
          },
          severity: 2
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

    it("job.check_run_id", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ job.check_run_id }}
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
        volumes:
          - my_docker_volume:/volume_mount
        ports:
          - 80:8080
    steps:
      - run: echo \${{ job.services.nginx }}
      - run: echo \${{ job.services.nginx.id }}
      - run: echo \${{ job.services.nginx.network }}
      - run: echo \${{ job.services.nginx.ports }}
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
    container:
      image: node:14.16
    steps:
      - run: echo \${{ job.container.tupperware }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Context access might be invalid: tupperware",
          range: {
            end: {
              character: 49,
              line: 9
            },
            start: {
              character: 18,
              line: 9
            }
          },
          severity: DiagnosticSeverity.Warning
        }
      ]);
    });
  });

  describe("jobs context", () => {
    it("jobs.<job_id>.result", async () => {
      const input = `
on:
  workflow_call:
    # Map the workflow outputs to job outputs
    outputs:
      successful:
        description: "Was job successful"
        value: \${{ jobs.example_job.result }}

jobs:
  example_job:
    runs-on: ubuntu-latest
    steps:
      - id: a
        run: echo hello world`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });

    it("jobs.<job_id>.outputs.<output_name>", async () => {
      const input = `
on:
  workflow_call:
    outputs:
      output1:
        description: "A greeting"
        value: \${{ jobs.example_job.outputs.output1 }}

jobs:
  example_job:
    name: Generate output
    runs-on: ubuntu-latest
    # Map the job outputs to step outputs
    outputs:
      output1: "\${{ steps.a.outputs.greeting }}"
    steps:
      - id: a
        run: echo "greeting=hello" >> $GITHUB_OUTPUT`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });
  });

  describe("env context", () => {
    it("references env within scope", async () => {
      const input = `
on: push
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
    - name: step a
      env:
        step_env: job_a_env
      run: echo "hello \${{ env.step_env }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });

    it("inherits parent env", async () => {
      const input = `
on: push
env:
  envwf: workflow_env
jobs:
  a:
    runs-on: ubuntu-latest
    env:
      envjoba: job_a_env
    steps:
    - name: step a
      run: echo "hello \${{ env.envwf }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });

    it("references env outside of scope", async () => {
      const input = `
on: push
env:
  envwf: workflow_env
jobs:
  a:
    runs-on: ubuntu-latest
    env:
      envjoba: job_a_env
    steps:
    - name: step a
      run: echo "hello"
      env:
        envstepa: step_a_env
    - name: step b
      run: echo "hello \${{ env.envstepa }}
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Context access might be invalid: envstepa",
          range: {
            end: {
              character: 42,
              line: 15
            },
            start: {
              character: 23,
              line: 15
            }
          },
          severity: DiagnosticSeverity.Warning
        }
      ]);
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

    it("reference strategy in reusable workflow", async () => {
      const input = `
  on: push

  jobs:
    test:
      strategy:
        fail-fast: true
        matrix:
          node: [14, 16]
      uses: ./.github/workflows/reusable-workflow-with-inputs.yaml
      with:
        username: User-\${{ strategy.fail-fast }}
  `;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });

    it("reference matrix in reusable workflow", async () => {
      const input = `
  on: push

  jobs:
    test:
      strategy:
        matrix:
          node: [14, 16]
      uses: ./.github/workflows/reusable-workflow-with-inputs.yaml
      with:
        username: \${{ matrix.node }}
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

      // Strategy context is always available with default values
      expect(result).toEqual([]);
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

  describe("multi-line strings warnings", () => {
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

  describe("multi-line strings errors", () => {
    it("indented |", async () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: |
          first line
          test \${{ fromJSON2('') }}
          test2`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Unrecognized function: 'fromJSON2'",
          range: {
            end: {
              character: 35,
              line: 7
            },
            start: {
              character: 15,
              line: 7
            }
          }
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
          test \${{ fromJSON2('') }}
          test2`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Unrecognized function: 'fromJSON2'",
          range: {
            end: {
              character: 35,
              line: 7
            },
            start: {
              character: 15,
              line: 7
            }
          }
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
          test \${{ fromJSON2('') }}
          test2`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Unrecognized function: 'fromJSON2'",
          range: {
            end: {
              character: 35,
              line: 7
            },
            start: {
              character: 15,
              line: 7
            }
          }
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
          test \${{ fromJSON2('') }}
          test2`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Unrecognized function: 'fromJSON2'",
          range: {
            end: {
              character: 35,
              line: 7
            },
            start: {
              character: 15,
              line: 7
            }
          }
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

      // Matrix is null when no strategy is defined, accessing properties on null is valid
      expect(result).toEqual([]);
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

  describe("github context", () => {
    it("includes only expected keys", async () => {
      const input = `
on: push

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ github.action }}
      - run: echo \${{ github.steps }}
`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Context access might be invalid: steps",
          range: {
            end: {
              character: 37,
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

    it("validates event payload", async () => {
      const input = `
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ github.event.forced }}
      - run: echo \${{ github.event.pull_request }}
      - run: echo \${{ github.event.schedule }}
`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Context access might be invalid: schedule",
          range: {
            end: {
              character: 46,
              line: 9
            },
            start: {
              character: 18,
              line: 9
            }
          },
          severity: DiagnosticSeverity.Warning
        }
      ]);
    });

    it("validates event inputs via github.event", async () => {
      const input = `
on:
  workflow_dispatch:
    inputs:
      name:
        type: string
        default: some value
      another-name:
        type: string
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
    - run: echo "hello \${{ github.event.inputs.name }}"
    - run: echo "hello \${{ github.event.inputs.another-name }}"
    - run: echo "hello \${{ github.event.inputs.random }}"
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Context access might be invalid: random",
          range: {
            start: {
              character: 23,
              line: 15
            },
            end: {
              character: 56,
              line: 15
            }
          },
          severity: 2
        }
      ]);
    });

    it("validates event inputs via inputs context", async () => {
      const input = `
on:
  workflow_dispatch:
    inputs:
      name:
        type: string
        default: some value
      another-name:
        type: string
  workflow_call:
    inputs:
      third-name:
        type: boolean
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
    - run: echo \${{ fromJSON(inputs.random2) }}
    - run: echo "hello \${{ inputs.random }}"
      name: "\${{ fromJSON('test') == inputs.name }}"
`;
      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([
        {
          message: "Context access might be invalid: random2",
          range: {
            start: {
              character: 16,
              line: 17
            },
            end: {
              character: 47,
              line: 17
            }
          },
          severity: 2
        },
        {
          message: "Context access might be invalid: random",
          range: {
            start: {
              character: 23,
              line: 18
            },
            end: {
              character: 43,
              line: 18
            }
          },
          severity: DiagnosticSeverity.Warning
        }
      ]);
    });

    it("allows any property in client_payload", async () => {
      const input = `
on:
  repository_dispatch:
    types: [test]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ github.event.client_payload.anything }}
      - run: echo \${{ github.event.client_payload.branch }}`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });

    it("allows any event property for workflow_call", async () => {
      const input = `
on:
  workflow_call:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ github.event.anything }}`;

      const result = await validate(createDocument("wf.yaml", input));

      expect(result).toEqual([]);
    });
  });

  describe("if condition context restrictions", () => {
    describe("job-level if", () => {
      it("allows github context", async () => {
        const input = `
on: push
jobs:
  build:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - run: echo hello`;

        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });

      it("allows needs context", async () => {
        const input = `
on: push
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - run: echo hello
  b:
    needs: a
    if: needs.a.result == 'success'
    runs-on: ubuntu-latest
    steps:
      - run: echo hello`;

        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });

      it("allows inputs context", async () => {
        const input = `
on:
  workflow_dispatch:
    inputs:
      environment:
        type: string
jobs:
  build:
    if: inputs.environment == 'prod'
    runs-on: ubuntu-latest
    steps:
      - run: echo hello`;

        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });

      // Note: vars and matrix contexts are validated at runtime based on their existence
      // vars context only exists if organization/repository variables are defined
      // matrix context only exists if a strategy.matrix is defined
    });

    describe("step-level if", () => {
      it("allows steps context", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - id: setup
        run: echo hello
      - if: steps.setup.outcome == 'success'
        run: echo world`;

        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });

      it("allows job context", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - if: job.status == 'success'
        run: echo hello`;

        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });

      it("allows runner context", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - if: runner.os == 'Linux'
        run: echo hello`;

        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });

      it("allows runner.environment context", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - if: runner.environment == 'github-hosted'
        run: echo hello`;

        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });

      it("allows runner.debug context", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - if: runner.debug == '1'
        run: echo hello`;

        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });

      it("allows runner.workspace context", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - if: runner.workspace != ''
        run: echo hello`;

        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });

      it("allows env context", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      MY_VAR: value
    steps:
      - if: env.MY_VAR == 'value'
        run: echo hello`;

        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });

      it("allows matrix context in matrix job", async () => {
        const input = `
on: push
jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu, windows]
    runs-on: ubuntu-latest
    steps:
      - if: matrix.os == 'ubuntu'
        run: echo hello`;

        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });

      it("allows hashFiles function", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - if: hashFiles('**/*.txt') != ''
        run: echo hello`;

        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });

      it("allows all contexts together", async () => {
        const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      JOB_VAR: job-value
    steps:
      - id: first
        run: echo hello
      - if: github.event_name == 'push' && steps.first.outcome == 'success' && job.status == 'success' && runner.os == 'Linux' && env.JOB_VAR == 'job-value'
        run: echo world`;

        const result = await validate(createDocument("wf.yaml", input));
        expect(result).toEqual([]);
      });
    });
  });
});
