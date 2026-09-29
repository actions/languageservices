import {InlayHintKind} from "vscode-languageserver-types";
import {getInlayHints} from "./inlay-hints.js";
import {registerLogger} from "./log.js";
import {createDocument} from "./test-utils/document.js";
import {TestLogger} from "./test-utils/logger.js";
import {clearCache} from "./utils/workflow-cache.js";

registerLogger(new TestLogger());

beforeEach(() => {
  clearCache();
});

describe("inlay-hints", () => {
  describe("cron expressions", () => {
    it("returns inlay hint for valid cron expression", () => {
      const input = `on:
  schedule:
    - cron: '0 * * * *'
`;
      const document = createDocument("test.yaml", input);
      const hints = getInlayHints(document);

      expect(hints).toHaveLength(1);
      expect(hints[0].label).toBe("→ Runs every hour");
      expect(hints[0].kind).toBe(InlayHintKind.Parameter);
      expect(hints[0].paddingLeft).toBe(true);
    });

    it("returns correct position at end of cron value", () => {
      const input = `on:
  schedule:
    - cron: '0 3 * * 1'
`;
      const document = createDocument("test.yaml", input);
      const hints = getInlayHints(document);

      expect(hints).toHaveLength(1);
      // Position should be at the end of the cron string value (after the closing quote)
      // Line 3 (0-indexed: 2), end of '0 3 * * 1'
      expect(hints[0].position.line).toBe(2);
    });

    it("returns no hint for invalid cron expression", () => {
      const input = `on:
  schedule:
    - cron: 'invalid cron'
`;
      const document = createDocument("test.yaml", input);
      const hints = getInlayHints(document);

      expect(hints).toHaveLength(0);
    });

    it("returns multiple hints for multiple cron expressions", () => {
      const input = `on:
  schedule:
    - cron: '0 * * * *'
    - cron: '0 0 * * *'
`;
      const document = createDocument("test.yaml", input);
      const hints = getInlayHints(document);

      expect(hints).toHaveLength(2);
      expect(hints[0].label).toBe("→ Runs every hour");
      expect(hints[1].label).toBe("→ Runs at 00:00");
    });

    it("returns hint with descriptive label for weekly cron", () => {
      const input = `on:
  schedule:
    - cron: '0 3 * * 1'
`;
      const document = createDocument("test.yaml", input);
      const hints = getInlayHints(document);

      expect(hints).toHaveLength(1);
      expect(hints[0].label).toContain("Monday");
    });

    it("returns no hints for empty workflow", () => {
      const input = ``;
      const document = createDocument("test.yaml", input);
      const hints = getInlayHints(document);

      expect(hints).toHaveLength(0);
    });

    it("returns no hints for workflow without schedule", () => {
      const input = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hello
`;
      const document = createDocument("test.yaml", input);
      const hints = getInlayHints(document);

      expect(hints).toHaveLength(0);
    });

    it("returns hint for frequent cron that triggers warning", () => {
      // Even crons that trigger the <5min warning should still get inlay hints
      const input = `on:
  schedule:
    - cron: '* * * * *'
`;
      const document = createDocument("test.yaml", input);
      const hints = getInlayHints(document);

      expect(hints).toHaveLength(1);
      expect(hints[0].label).toBe("→ Runs every minute");
    });
  });
});
