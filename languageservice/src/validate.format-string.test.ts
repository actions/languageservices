import {Diagnostic} from "vscode-languageserver-types";
import {createDocument} from "./test-utils/document.js";
import {validate} from "./validate.js";
import {clearCache} from "./utils/workflow-cache.js";

beforeEach(() => {
  clearCache();
});

function hasMessageContaining(results: Diagnostic[], substring: string): boolean {
  return results.some(r => r.message.includes(substring));
}

describe("format string validation", () => {
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
      expect(hasMessageContaining(result, "Invalid format string")).toBe(true);
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
      expect(hasMessageContaining(result, "Invalid format string")).toBe(true);
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
      expect(hasMessageContaining(result, "Invalid format string")).toBe(true);
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
      expect(hasMessageContaining(result, "Invalid format string")).toBe(false);
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
      expect(hasMessageContaining(result, "Invalid format string")).toBe(false);
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
      expect(hasMessageContaining(result, "Format string references {2}")).toBe(true);
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
      expect(hasMessageContaining(result, "Format string references {0}")).toBe(true);
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
      expect(hasMessageContaining(result, "Format string references")).toBe(false);
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
      expect(hasMessageContaining(result, "Format string references")).toBe(false);
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
      expect(hasMessageContaining(result, "Invalid format string")).toBe(false);
      expect(hasMessageContaining(result, "Format string references")).toBe(false);
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
      expect(hasMessageContaining(result, "Format string references {2}")).toBe(true);
    });
  });
});
