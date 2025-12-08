import {Diagnostic, DiagnosticSeverity} from "vscode-languageserver-types";
import {createDocument} from "./test-utils/document";
import {validate} from "./validate";
import {defaultValueProviders} from "./value-providers/default";
import {clearCache} from "./utils/workflow-cache";
import {ValueProviderConfig, ValueProviderKind} from "./value-providers/config";

beforeEach(() => {
  clearCache();
});

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

  it("single value not returned by suggested value provider", async () => {
    const result = await validate(
      createDocument(
        "wf.yaml",
        `on: push
jobs:
  build:
    runs-on: does-not-exist
    steps:
    - run: echo`
      ),
      {valueProviderConfig: defaultValueProviders}
    );

    expect(result.length).toBe(0);
  });

  it("value in sequence not returned by value provider", async () => {
    const result = await validate(
      createDocument(
        "wf.yaml",
        `on: push
jobs:
  build:
    runs-on:
    - ubuntu-latest
    - does-not-exist
    steps:
    - run: echo`
      ),
      {valueProviderConfig: defaultValueProviders}
    );

    expect(result.length).toBe(0);
  });

  it("single value not returned by allowed value provider", async () => {
    const result = await validate(
      createDocument(
        "wf.yaml",
        `on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - run: echo
  build:
    runs-on: ubuntu-latest
    needs: test2
    steps:
    - run: echo`
      ),
      {valueProviderConfig: defaultValueProviders}
    );

    expect(result[0]).toEqual({
      message: "Value 'test2' is not valid",
      severity: DiagnosticSeverity.Error,
      range: {
        end: {
          character: 16,
          line: 8
        },
        start: {
          character: 11,
          line: 8
        }
      }
    } as Diagnostic);
  });

  it("unknown event type", async () => {
    const result = await validate(
      createDocument(
        "wf.yaml",
        `on: [push, check_run, pr]
jobs:
  build:
    runs-on:
    - ubuntu-latest`
      ),
      {valueProviderConfig: defaultValueProviders}
    );

    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      message: "Unexpected value 'pr'",
      range: {
        end: {
          character: 24,
          line: 0
        },
        start: {
          character: 22,
          line: 0
        }
      }
    } as Diagnostic);
  });

  it("invalid cron string", async () => {
    const result = await validate(
      createDocument(
        "wf.yaml",
        `on:
  schedule:
    - cron: '0 0 * *'
jobs:
  build:
    runs-on: ubuntu-latest`
      ),
      {valueProviderConfig: defaultValueProviders}
    );

    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      message: "Invalid cron expression. Expected format: '* * * * *' (minute hour day month weekday)",
      range: {
        end: {
          character: 21,
          line: 2
        },
        start: {
          character: 12,
          line: 2
        }
      }
    } as Diagnostic);
  });

  it("cron with interval less than 5 minutes shows warning", async () => {
    const result = await validate(
      createDocument(
        "wf.yaml",
        `on:
  schedule:
    - cron: '*/1 * * * *'
jobs:
  build:
    runs-on: ubuntu-latest`
      ),
      {valueProviderConfig: defaultValueProviders}
    );

    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      message:
        'Actions schedules run at most every 5 minutes. "*/1 * * * *" (runs every minute) will not run as frequently as specified.',
      severity: DiagnosticSeverity.Warning,
      code: "on-schedule",
      codeDescription: {
        href: "https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#onschedule"
      },
      range: {
        end: {
          character: 25,
          line: 2
        },
        start: {
          character: 12,
          line: 2
        }
      }
    } as Diagnostic);
  });

  it("cron with interval of 5 minutes or more shows info", async () => {
    const result = await validate(
      createDocument(
        "wf.yaml",
        `on:
  schedule:
    - cron: '*/5 * * * *'
jobs:
  build:
    runs-on: ubuntu-latest`
      ),
      {valueProviderConfig: defaultValueProviders}
    );

    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      message: "Runs every 5 minutes",
      severity: DiagnosticSeverity.Information,
      code: "on-schedule",
      codeDescription: {
        href: "https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#onschedule"
      },
      range: {
        end: {
          character: 25,
          line: 2
        },
        start: {
          character: 12,
          line: 2
        }
      }
    } as Diagnostic);
  });

  it("cron with comma-separated minutes less than 5 apart shows warning", async () => {
    const result = await validate(
      createDocument(
        "wf.yaml",
        `on:
  schedule:
    - cron: '0,2 * * * *'
jobs:
  build:
    runs-on: ubuntu-latest`
      ),
      {valueProviderConfig: defaultValueProviders}
    );

    expect(result.length).toBe(1);
    expect(result[0]?.severity).toBe(DiagnosticSeverity.Warning);
    expect(result[0]?.message).toContain("Actions schedules run at most every 5 minutes.");
  });

  it("invalid YAML", async () => {
    // This YAML has some mismatched single-quotes, which causes the string to be terminated early
    // within the fromJSON() expression.
    // Using double-quotes would make it valid:
    // "Run a \${{ inputs.test }} one-line script \${{ fromJSON('test') == inputs.name }}"
    const workflow = `
    on: push
    jobs:
      build:
        runs-on: ubuntu-latest
        environment: TEST
        steps:
        - name: 'Run a \${{ inputs.test }} one-line script \${{ fromJSON('test') == inputs.name }}'
          run: echo
    `;
    const result = await validate(createDocument("wf.yaml", workflow), {valueProviderConfig: defaultValueProviders});

    expect(result).toEqual([
      {
        message:
          "Unexpected scalar at node end at line 8, column 73:\n\n…un a ${{ inputs.test }} one-line script ${{ fromJSON('test') == inputs.name }}'\n                                                       ^^^^^^^^^^^^^^^^^^^^^^^^^\n",
        range: {
          start: {
            line: 7,
            character: 72
          },
          end: {
            line: 7,
            character: 97
          }
        }
      }
    ]);

    const cachedResult = await validate(createDocument("wf.yaml", workflow), {
      valueProviderConfig: defaultValueProviders
    });
    expect(cachedResult).toEqual(result);
  });

  describe("value provider case sensitivity", () => {
    it("value with a different case and case sensitive provider", async () => {
      const workflow = `
  on: push
  jobs:
    build:
      runs-on: ubuntu-latest
      environment: TEST
      steps:
      - run: echo
  `;
      const valueProviderConfig: ValueProviderConfig = {
        "job-environment": {
          kind: ValueProviderKind.AllowedValues,
          get: () => Promise.resolve([{label: "test"}]),
          caseInsensitive: false
        }
      };

      const result = await validate(createDocument("wf.yaml", workflow), {valueProviderConfig});
      expect(result).toEqual([
        {
          message: "Value 'TEST' is not valid",
          severity: DiagnosticSeverity.Error,
          range: {
            start: {
              line: 5,
              character: 19
            },
            end: {
              line: 5,
              character: 23
            }
          }
        }
      ]);
    });

    it("value with a different case and case insensitive provider", async () => {
      const workflow = `
  on: push
  jobs:
    build:
      runs-on: ubuntu-latest
      environment: TEST
      steps:
      - run: echo
  `;
      const valueProviderConfig: ValueProviderConfig = {
        "job-environment": {
          kind: ValueProviderKind.AllowedValues,
          get: () => Promise.resolve([{label: "test"}]),
          caseInsensitive: true
        }
      };

      const result = await validate(createDocument("wf.yaml", workflow), {valueProviderConfig});
      expect(result).toEqual([]);
    });
  });

  describe("workflow_dispatch", () => {
    it("allows empty string in choice options", async () => {
      const result = await validate(
        createDocument(
          "wf.yaml",
          `on:
  workflow_dispatch:
    inputs:
      plugin-name:
        description: Specific plugin to build
        type: choice
        options:
          - ''
          - foo
          - bar
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: echo`
        )
      );

      expect(result).toEqual([]);
    });
  });
});
