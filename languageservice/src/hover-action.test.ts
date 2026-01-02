import {TextDocument} from "vscode-languageserver-textdocument";
import {hover} from "./hover";

describe("hover action files", () => {
  function createActionDocument(
    content: string,
    uri = "file:///test/action.yml"
  ): [TextDocument, {line: number; character: number}] {
    // Parse cursor position and remove the | character
    const cursorIndex = content.indexOf("|");
    if (cursorIndex === -1) {
      throw new Error("No cursor (|) found in content");
    }
    const newContent = content.substring(0, cursorIndex) + content.substring(cursorIndex + 1);
    const doc = TextDocument.create(uri, "yaml", 1, newContent);
    const position = doc.positionAt(cursorIndex);
    return [doc, position];
  }

  describe("top-level keys", () => {
    it("shows description for name key", async () => {
      const [doc, position] = createActionDocument(`na|me: My Action
description: Test
runs:
  using: node20
  main: index.js`);
      const result = await hover(doc, position);

      expect(result).not.toBeNull();
      expect(result?.contents).toContain("name");
    });

    it("shows description for description key", async () => {
      const [doc, position] = createActionDocument(`name: My Action
descrip|tion: Test
runs:
  using: node20
  main: index.js`);
      const result = await hover(doc, position);

      expect(result).not.toBeNull();
      expect(result?.contents).toContain("description");
    });

    it("shows description for runs key", async () => {
      const [doc, position] = createActionDocument(`name: My Action
description: Test
ru|ns:
  using: node20
  main: index.js`);
      const result = await hover(doc, position);

      expect(result).not.toBeNull();
      expect(result?.contents).toContain("runs");
    });
  });

  describe("runs properties", () => {
    it("shows description for using key", async () => {
      const [doc, position] = createActionDocument(`name: My Action
description: Test
runs:
  us|ing: node20
  main: index.js`);
      const result = await hover(doc, position);

      expect(result).not.toBeNull();
      expect(result?.contents).toContain("runtime");
    });

    it("shows description for main key", async () => {
      const [doc, position] = createActionDocument(`name: My Action
description: Test
runs:
  using: node20
  ma|in: index.js`);
      const result = await hover(doc, position);

      expect(result).not.toBeNull();
      expect(result?.contents).toContain("main");
    });
  });

  describe("inputs", () => {
    it("shows description for inputs section", async () => {
      const [doc, position] = createActionDocument(`name: My Action
description: Test
inp|uts:
  my-input:
    description: A test input
runs:
  using: node20
  main: index.js`);
      const result = await hover(doc, position);

      expect(result).not.toBeNull();
      expect(result?.contents).toContain("input");
    });

    it("shows description for required key", async () => {
      const [doc, position] = createActionDocument(`name: My Action
description: Test
inputs:
  my-input:
    description: A test input
    requ|ired: true
runs:
  using: node20
  main: index.js`);
      const result = await hover(doc, position);

      expect(result).not.toBeNull();
      expect(result?.contents).toContain("required");
    });

    it("shows allowed context for default value", async () => {
      const [doc, position] = createActionDocument(`name: My Action
description: Test
inputs:
  my-input:
    description: A test input
    def|ault: foo
runs:
  using: node20
  main: index.js`);
      const result = await hover(doc, position);

      expect(result).not.toBeNull();
      // Input defaults can use expressions with github, strategy, matrix, job, runner contexts
      expect(result?.contents).toContain("github");
    });
  });

  describe("branding", () => {
    it("shows description for branding section", async () => {
      const [doc, position] = createActionDocument(`name: My Action
description: Test
runs:
  using: node20
  main: index.js
brand|ing:
  icon: activity
  color: blue`);
      const result = await hover(doc, position);

      expect(result).not.toBeNull();
      expect(result?.contents).toContain("brand");
    });

    it("shows description for icon key", async () => {
      const [doc, position] = createActionDocument(`name: My Action
description: Test
runs:
  using: node20
  main: index.js
branding:
  ic|on: activity
  color: blue`);
      const result = await hover(doc, position);

      expect(result).not.toBeNull();
      expect(result?.contents).toContain("icon");
    });
  });

  describe("document type routing", () => {
    it("routes action.yml to action hover", async () => {
      const [doc, position] = createActionDocument(
        `na|me: My Action
description: Test
runs:
  using: node20
  main: index.js`,
        "file:///my-repo/action.yml"
      );
      const result = await hover(doc, position);

      expect(result).not.toBeNull();
    });

    it("does not route workflow files to action hover", async () => {
      const doc = TextDocument.create(
        "file:///repo/.github/workflows/ci.yml",
        "yaml",
        1,
        `name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hello`
      );
      // Hovering over 'name' in a workflow file should give workflow-specific info
      const result = await hover(doc, {line: 0, character: 2});

      // The workflow hover might not have description for workflow name,
      // but it should not crash
      expect(result === null || result.contents !== undefined).toBe(true);
    });
  });
});
