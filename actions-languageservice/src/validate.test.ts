import {Diagnostic, DiagnosticSeverity} from "vscode-languageserver-types";
import {createDocument} from "./test-utils/document";
import {validate} from "./validate";
import {defaultValueProviders} from "./value-providers/default";

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
      defaultValueProviders
    );

    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      message: "Value 'does-not-exist' is not valid",
      severity: DiagnosticSeverity.Warning,
      range: {
        end: {
          character: 27,
          line: 3
        },
        start: {
          character: 13,
          line: 3
        }
      }
    } as Diagnostic);
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
      defaultValueProviders
    );

    expect(result.length).toBe(1);
    expect(result[0]).toEqual({
      message: "Value 'does-not-exist' is not valid",
      severity: DiagnosticSeverity.Warning,
      range: {
        end: {
          character: 20,
          line: 5
        },
        start: {
          character: 6,
          line: 5
        }
      }
    } as Diagnostic);
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
      defaultValueProviders
    );

    expect(result.length).toBe(1);
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
});
