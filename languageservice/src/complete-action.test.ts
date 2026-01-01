import {TextDocument} from "vscode-languageserver-textdocument";
import {complete} from "./complete";
import {clearCache} from "./utils/workflow-cache";

beforeEach(() => {
  clearCache();
});

describe("complete action files", () => {
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

  describe("expression completion in composite actions", () => {
    it("completes inputs context", async () => {
      const [doc, position] = createActionDocument(`name: My Action
description: Test action
inputs:
  name:
    description: The name
  greeting:
    description: The greeting
    default: Hello
runs:
  using: composite
  steps:
    - run: echo "\${{ inputs.| }}"
      shell: bash`);
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      expect(labels).toContain("name");
      expect(labels).toContain("greeting");
    });

    it("completes steps context with prior step IDs", async () => {
      const [doc, position] = createActionDocument(`name: My Action
description: Test action
runs:
  using: composite
  steps:
    - id: step1
      run: echo "hello"
      shell: bash
    - id: step2
      run: echo "\${{ steps.| }}"
      shell: bash`);
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      expect(labels).toContain("step1");
      expect(labels).not.toContain("step2"); // Current step should not be included
    });

    it("completes step properties", async () => {
      const [doc, position] = createActionDocument(`name: My Action
description: Test action
runs:
  using: composite
  steps:
    - id: greet
      run: echo "hello"
      shell: bash
    - run: echo "\${{ steps.greet.| }}"
      shell: bash`);
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      expect(labels).toContain("outputs");
      expect(labels).toContain("outcome");
      expect(labels).toContain("conclusion");
    });

    it("does not include steps from after cursor position", async () => {
      const [doc, position] = createActionDocument(`name: My Action
description: Test action
runs:
  using: composite
  steps:
    - id: first
      run: echo "first"
      shell: bash
    - run: echo "\${{ steps.| }}"
      shell: bash
    - id: last
      run: echo "last"
      shell: bash`);
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      expect(labels).toContain("first");
      expect(labels).not.toContain("last");
    });

    it("completes github context in actions", async () => {
      const [doc, position] = createActionDocument(`name: My Action
description: Test action
runs:
  using: composite
  steps:
    - run: echo "\${{ github.| }}"
      shell: bash`);
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      expect(labels).toContain("actor");
      expect(labels).toContain("repository");
      expect(labels).toContain("ref");
    });

    it("completes runner context in actions", async () => {
      const [doc, position] = createActionDocument(`name: My Action
description: Test action
runs:
  using: composite
  steps:
    - run: echo "\${{ runner.| }}"
      shell: bash`);
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      expect(labels).toContain("os");
      expect(labels).toContain("arch");
      expect(labels).toContain("temp");
    });
  });

  describe("top-level completions", () => {
    it("completes top-level keys", async () => {
      const [doc, position] = createActionDocument(`n|`);
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      expect(labels).toContain("name");
    });

    it("completes at empty line", async () => {
      const [doc, position] = createActionDocument(`name: My Action
|`);
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      expect(labels).toContain("description");
      expect(labels).toContain("runs");
      expect(labels).toContain("inputs");
      expect(labels).toContain("outputs");
      expect(labels).toContain("branding");
      expect(labels).toContain("author");
    });
  });

  describe("runs completions", () => {
    it("completes runs.using values", async () => {
      const [doc, position] = createActionDocument(`name: Test
description: Test
runs:
  using: |`);
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      expect(labels).toContain("composite");
      expect(labels).toContain("node20");
      expect(labels).toContain("docker");
    });

    it("completes runs keys", async () => {
      const [doc, position] = createActionDocument(`name: Test
description: Test
runs:
  |`);
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      expect(labels).toContain("using");
    });
  });

  describe("branding completions", () => {
    it("completes branding keys", async () => {
      const [doc, position] = createActionDocument(`name: Test
description: Test
runs:
  using: node20
  main: index.js
branding:
  |`);
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      expect(labels).toContain("icon");
      expect(labels).toContain("color");
    });

    it("completes branding color values", async () => {
      const [doc, position] = createActionDocument(`name: Test
description: Test
runs:
  using: node20
  main: index.js
branding:
  color: |`);
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      expect(labels).toContain("blue");
      expect(labels).toContain("green");
      expect(labels).toContain("red");
    });
  });

  describe("inputs completions", () => {
    it("completes input property keys", async () => {
      const [doc, position] = createActionDocument(`name: Test
description: Test
inputs:
  my-input:
    |
runs:
  using: node20
  main: index.js`);
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      expect(labels).toContain("description");
      expect(labels).toContain("required");
      expect(labels).toContain("default");
      expect(labels).toContain("deprecationMessage");
    });
  });

  describe("document type routing", () => {
    it("routes action.yml to action completion", async () => {
      const [doc, position] = createActionDocument(`n|`, "file:///my-repo/action.yml");
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      expect(labels).toContain("name");
      // Should NOT contain workflow-specific keys
      expect(labels).not.toContain("on");
      expect(labels).not.toContain("jobs");
    });

    it("does not route workflow files to action completion", async () => {
      const doc = TextDocument.create("file:///repo/.github/workflows/ci.yml", "yaml", 1, `o`);
      const completions = await complete(doc, {line: 0, character: 1});
      const labels = completions.map(c => c.label);

      expect(labels).toContain("on");
      expect(labels).toContain("jobs");
    });
  });
});
