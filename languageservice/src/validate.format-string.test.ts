import {DiagnosticSeverity} from "vscode-languageserver-types";
import {createDocument} from "./test-utils/document.js";
import {validate} from "./validate.js";
import {clearCache} from "./utils/workflow-cache.js";
import {validateFormatString} from "./validate-format-string.js";

beforeEach(() => {
  clearCache();
});

describe("format string validation", () => {
  describe("validateFormatString unit tests", () => {
    it("returns valid for simple placeholder", () => {
      const result = validateFormatString("{0}");
      expect(result).toEqual({valid: true, maxArgIndex: 0});
    });

    it("returns valid for multiple placeholders", () => {
      const result = validateFormatString("{0} {1} {2}");
      expect(result).toEqual({valid: true, maxArgIndex: 2});
    });

    it("returns valid for text with placeholder", () => {
      const result = validateFormatString("hello {0} world");
      expect(result).toEqual({valid: true, maxArgIndex: 0});
    });

    it("returns valid for escaped left braces", () => {
      const result = validateFormatString("{{0}} {0}");
      expect(result).toEqual({valid: true, maxArgIndex: 0});
    });

    it("returns valid for escaped right braces", () => {
      const result = validateFormatString("{0}}}");
      expect(result).toEqual({valid: true, maxArgIndex: 0});
    });

    it("returns valid for no placeholders", () => {
      const result = validateFormatString("hello world");
      expect(result).toEqual({valid: true, maxArgIndex: -1});
    });

    it("returns invalid for missing closing brace", () => {
      const result = validateFormatString("{0");
      expect(result).toEqual({valid: false, maxArgIndex: -1});
    });

    it("returns invalid for empty placeholder", () => {
      const result = validateFormatString("{}");
      expect(result).toEqual({valid: false, maxArgIndex: -1});
    });

    it("returns invalid for non-numeric placeholder", () => {
      const result = validateFormatString("{abc}");
      expect(result).toEqual({valid: false, maxArgIndex: -1});
    });

    it("returns invalid for unescaped closing brace", () => {
      const result = validateFormatString("text } more");
      expect(result).toEqual({valid: false, maxArgIndex: -1});
    });

    it("handles out-of-order placeholders", () => {
      const result = validateFormatString("{2} {0} {1}");
      expect(result).toEqual({valid: true, maxArgIndex: 2});
    });

    it("handles repeated placeholders", () => {
      const result = validateFormatString("{0} {0} {0}");
      expect(result).toEqual({valid: true, maxArgIndex: 0});
    });
  });

  describe("InvalidFormatString workflow validation", () => {
    it("errors on missing closing brace", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ format('{0', github.event_name) }}
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toContainEqual(
        expect.objectContaining({
          code: "invalid-format-string",
          severity: DiagnosticSeverity.Error
        })
      );
    });

    it("errors on empty braces", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ format('{}', github.event_name) }}
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toContainEqual(
        expect.objectContaining({
          code: "invalid-format-string"
        })
      );
    });

    it("errors on non-numeric placeholder", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ format('{abc}', github.event_name) }}
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toContainEqual(
        expect.objectContaining({
          code: "invalid-format-string"
        })
      );
    });

    it("allows valid format strings", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ format('{0} {1}', github.event_name, github.ref) }}
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).not.toContainEqual(
        expect.objectContaining({
          code: "invalid-format-string"
        })
      );
    });

    it("allows escaped braces", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ format('{{0}} {0}', github.event_name) }}
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).not.toContainEqual(
        expect.objectContaining({
          code: "invalid-format-string"
        })
      );
    });
  });

  describe("FormatArgCountMismatch workflow validation", () => {
    it("errors when placeholder exceeds arg count", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ format('{2}', 'arg0', 'arg1') }}
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toContainEqual(
        expect.objectContaining({
          code: "format-arg-count-mismatch",
          severity: DiagnosticSeverity.Error
        })
      );
    });

    it("errors when referencing arg 0 with no args", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ format('{0}') }}
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).toContainEqual(
        expect.objectContaining({
          code: "format-arg-count-mismatch"
        })
      );
    });

    it("allows when arg count matches", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ format('{0} {1} {2}', 'a', 'b', 'c') }}
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).not.toContainEqual(
        expect.objectContaining({
          code: "format-arg-count-mismatch"
        })
      );
    });

    it("handles no placeholders correctly", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ format('hello world') }}
`;
      const result = await validate(createDocument("wf.yaml", input));
      expect(result).not.toContainEqual(
        expect.objectContaining({
          code: "format-arg-count-mismatch"
        })
      );
    });

    it("skips validation for dynamic format strings", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ format(env.FORMAT_STRING, 'arg') }}
`;
      const result = await validate(createDocument("wf.yaml", input));
      // Should not have format errors since we can't validate dynamic strings
      expect(result).not.toContainEqual(
        expect.objectContaining({
          code: "invalid-format-string"
        })
      );
      expect(result).not.toContainEqual(
        expect.objectContaining({
          code: "format-arg-count-mismatch"
        })
      );
    });

    it("validates nested format calls", async () => {
      const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo \${{ format('{0}', format('{2}', 'a')) }}
`;
      const result = await validate(createDocument("wf.yaml", input));
      // The inner format call has an error
      expect(result).toContainEqual(
        expect.objectContaining({
          code: "format-arg-count-mismatch"
        })
      );
    });
  });
});
