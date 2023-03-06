import {DiagnosticSeverity} from "vscode-languageserver-types";
import {ActionMetadata, ActionReference} from "./action";
import {registerLogger} from "./log";
import {createDocument} from "./test-utils/document";
import {TestLogger} from "./test-utils/logger";
import {validate, ValidationConfig} from "./validate";
import {ValueProviderKind} from "./value-providers/config";
import {clearCache} from "./utils/workflow-cache";

registerLogger(new TestLogger());

beforeEach(() => {
  clearCache();
});

const validationConfig: ValidationConfig = {
  fetchActionMetadata: async (ref: ActionReference) => {
    let metadata: ActionMetadata | undefined = undefined;
    switch (ref.owner + "/" + ref.name + "@" + ref.ref) {
      case "actions/checkout@v3":
        metadata = {
          inputs: {
            repository: {
              description: "Repository name with owner",
              default: "${{ github.repository }}"
            }
          }
        };
        break;
      case "actions/setup-node@v1":
        metadata = {
          inputs: {
            version: {
              description: "Deprecated. Use node-version instead. Will not be supported after October 1, 2019",
              deprecationMessage:
                "The version property will not be supported after October 1, 2019. Use node-version instead"
            }
          }
        };
        break;
      case "actions/deploy-pages@main":
        metadata = {
          inputs: {
            token: {
              required: true,
              description: "token to use",
              default: "${{ github.token }}"
            }
          }
        };
        break;
      case "actions/cache@v1":
        metadata = {
          inputs: {
            path: {
              description: "A directory to store and save the cache",
              required: true
            },
            key: {
              description: "An explicit key for restoring and saving the cache",
              required: true
            },
            "restore-keys": {
              description: "An ordered list of keys to use for restoring the cache if no cache hit occurred for key",
              required: false
            }
          }
        };
        break;
      case "actions/action-no-input@v1":
        metadata = {};
    }
    return metadata;
  }
};

describe("validate action steps", () => {
  it("valid action reference", async () => {
    const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
`;
    const result = await validate(createDocument("wf.yaml", input), validationConfig);

    expect(result).toEqual([]);
  });

  it("action does not exist", async () => {
    const input = `
    on: push
    jobs:
      build:
        runs-on: ubuntu-latest
        steps:
        - uses: actions/does-not-exist@v3
    `;
    const result = await validate(createDocument("wf.yaml", input), validationConfig);

    expect(result).toEqual([
      {
        message: "Unable to resolve action `actions/does-not-exist@v3`, repository or version not found",
        range: {
          end: {
            character: 41,
            line: 6
          },
          start: {
            character: 16,
            line: 6
          }
        },
        severity: DiagnosticSeverity.Error
      }
    ]);
  });

  it("action does not define inputs", async () => {
    const input = `
    on: push
    jobs:
      build:
        runs-on: ubuntu-latest
        steps:
        - uses: actions/action-no-input@v1
    `;
    const result = await validate(createDocument("wf.yaml", input), validationConfig);

    expect(result).toEqual([]);
  });

  it("invalid input", async () => {
    const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
      with:
        notanoption: true
`;
    const result = await validate(createDocument("wf.yaml", input), validationConfig);

    expect(result).toEqual([
      {
        message: "Invalid action input 'notanoption'",
        range: {
          end: {
            character: 19,
            line: 8
          },
          start: {
            character: 8,
            line: 8
          }
        },
        severity: DiagnosticSeverity.Error
      }
    ]);
  });

  it("deprecated input", async () => {
    const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/setup-node@v1
      with:
        version: 10
`;
    const result = await validate(createDocument("wf.yaml", input), validationConfig);

    expect(result).toEqual([
      {
        message: "The version property will not be supported after October 1, 2019. Use node-version instead",
        range: {
          end: {
            character: 15,
            line: 8
          },
          start: {
            character: 8,
            line: 8
          }
        },
        severity: DiagnosticSeverity.Warning
      }
    ]);
  });

  it("missing required input", async () => {
    const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/cache@v1
      with:
        key: \${{ runner.os }}-node-\${{ hashFiles('**/package-lock.json') }}
`;
    const result = await validate(createDocument("wf.yaml", input), validationConfig);

    expect(result).toEqual([
      {
        message: "Missing required input `path`",
        range: {
          end: {
            character: 10,
            line: 7
          },
          start: {
            character: 6,
            line: 7
          }
        },
        severity: DiagnosticSeverity.Error
      }
    ]);
  });

  it("required input with default value", async () => {
    const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/deploy-pages@main
`;
    const result = await validate(createDocument("wf.yaml", input), validationConfig);

    expect(result).toEqual([]);
  });

  it("multiple missing required inputs", async () => {
    const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/cache@v1
      with:
        restore-keys: \${{ runner.os }}-node-
`;
    const result = await validate(createDocument("wf.yaml", input), validationConfig);

    expect(result).toEqual([
      {
        message: "Missing required inputs: `path`, `key`",
        range: {
          end: {
            character: 10,
            line: 7
          },
          start: {
            character: 6,
            line: 7
          }
        },
        severity: DiagnosticSeverity.Error
      }
    ]);
  });

  it("missing required inputs without a `with` key", async () => {
    const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/cache@v1
`;
    const result = await validate(createDocument("wf.yaml", input), validationConfig);

    expect(result).toEqual([
      {
        message: "Missing required inputs: `path`, `key`",
        range: {
          end: {
            character: 0,
            line: 7
          },
          start: {
            character: 6,
            line: 6
          }
        },
        severity: DiagnosticSeverity.Error
      }
    ]);
  });

  it("skips extra validation from custom value provider", async () => {
    const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
      with:
        notanoption: true
`;
    const config = validationConfig;
    config.valueProviderConfig = {
      "step-with": {
        kind: ValueProviderKind.AllowedValues,
        get: async () => {
          return [{label: "repository", description: "Repository name with owner."}];
        }
      }
    };
    const result = await validate(createDocument("wf.yaml", input), config);

    expect(result).toEqual([
      {
        message: "Invalid action input 'notanoption'",
        range: {
          end: {
            character: 19,
            line: 8
          },
          start: {
            character: 8,
            line: 8
          }
        },
        severity: DiagnosticSeverity.Error
      }
    ]);
  });
});
