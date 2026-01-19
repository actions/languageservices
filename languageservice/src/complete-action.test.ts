import {FeatureFlags} from "@actions/expressions";
import {TextDocument} from "vscode-languageserver-textdocument";
import {complete, CompletionConfig} from "./complete";
import {clearCache} from "./utils/workflow-cache";

beforeEach(() => {
  clearCache();
});

// Config to enable action scaffolding snippets
const scaffoldingConfig: CompletionConfig = {
  featureFlags: new FeatureFlags({actionScaffoldingSnippets: true})
};

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

    it("filters runs keys for node20 actions", async () => {
      const [doc, position] = createActionDocument(`name: Test
description: Test
runs:
  using: node20
  |`);
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      // Should show Node.js action keys
      expect(labels).toContain("main");
      expect(labels).toContain("pre");
      expect(labels).toContain("post");
      expect(labels).toContain("pre-if");
      expect(labels).toContain("post-if");

      // Should NOT show composite or docker keys
      expect(labels).not.toContain("steps");
      expect(labels).not.toContain("image");
      expect(labels).not.toContain("entrypoint");
    });

    it("filters runs keys for composite actions", async () => {
      const [doc, position] = createActionDocument(`name: Test
description: Test
runs:
  using: composite
  |`);
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      // Should show composite action keys
      expect(labels).toContain("steps");

      // Should NOT show Node.js or docker keys
      expect(labels).not.toContain("main");
      expect(labels).not.toContain("pre");
      expect(labels).not.toContain("post");
      expect(labels).not.toContain("image");
    });

    it("filters runs keys for docker actions", async () => {
      const [doc, position] = createActionDocument(`name: Test
description: Test
runs:
  using: docker
  |`);
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      // Should show Docker action keys
      expect(labels).toContain("image");
      expect(labels).toContain("args");
      expect(labels).toContain("env");
      expect(labels).toContain("entrypoint");
      expect(labels).toContain("pre-entrypoint");
      expect(labels).toContain("post-entrypoint");

      // Should NOT show Node.js or composite keys
      expect(labels).not.toContain("main");
      expect(labels).not.toContain("steps");
    });

    it("prioritizes using when not set", async () => {
      const [doc, position] = createActionDocument(`name: Test
description: Test
runs:
  |`);
      const completions = await complete(doc, position);

      // Find the using completion
      const usingCompletion = completions.find(c => c.label === "using");
      expect(usingCompletion).toBeDefined();

      // It should have a sortText that makes it sort after snippets
      expect(usingCompletion?.sortText).toBe("9_using");
    });

    it("completes step keys inside composite action steps", async () => {
      const [doc, position] = createActionDocument(`name: Test
description: Test
runs:
  using: composite
  steps:
    - run: echo hello
      shell: bash
    - |`);
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      // Should show step keys, not filtered by runs-level logic
      expect(labels).toContain("run");
      expect(labels).toContain("uses");
      expect(labels).toContain("shell");
      expect(labels).toContain("id");
      expect(labels).toContain("name");
      expect(labels).toContain("if");
      expect(labels).toContain("env");
      expect(labels).toContain("working-directory");
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

    it("includes descriptions from schema for completion items", async () => {
      const [doc, position] = createActionDocument(`|`, "file:///my-repo/action.yml");
      const completions = await complete(doc, position);

      const authorCompletion = completions.find(c => c.label === "author");
      expect(authorCompletion).toBeDefined();
      expect(authorCompletion?.documentation).toBeDefined();
      expect((authorCompletion?.documentation as {value: string})?.value).toContain("author");
    });

    it("includes descriptions for branding completion", async () => {
      const [doc, position] = createActionDocument(`|`, "file:///my-repo/action.yml");
      const completions = await complete(doc, position);

      const brandingCompletion = completions.find(c => c.label === "branding");
      expect(brandingCompletion).toBeDefined();
      expect(brandingCompletion?.documentation).toBeDefined();
      expect((brandingCompletion?.documentation as {value: string})?.value).toContain("branding");
    });

    it("falls back to type description when property has no description", async () => {
      // `inputs` uses shorthand form in schema: "inputs": "inputs-strict"
      // So the property has no description, but the type `inputs-strict` does
      const [doc, position] = createActionDocument(`|`, "file:///my-repo/action.yml");
      const completions = await complete(doc, position);

      const inputsCompletion = completions.find(c => c.label === "inputs");
      expect(inputsCompletion).toBeDefined();
      expect(inputsCompletion?.documentation).toBeDefined();
      expect((inputsCompletion?.documentation as {value: string})?.value).toContain("Input parameters");
    });

    it("does not route workflow files to action completion", async () => {
      const doc = TextDocument.create("file:///repo/.github/workflows/ci.yml", "yaml", 1, `o`);
      const completions = await complete(doc, {line: 0, character: 1});
      const labels = completions.map(c => c.label);

      expect(labels).toContain("on");
      expect(labels).toContain("jobs");
    });
  });

  describe("action scaffolding snippets", () => {
    it("offers full scaffolding snippets in empty file", async () => {
      const [doc, position] = createActionDocument(`|`);
      const completions = await complete(doc, position, scaffoldingConfig);
      const labels = completions.map(c => c.label);

      expect(labels).toContain("Node.js Action");
      expect(labels).toContain("Composite Action");
      expect(labels).toContain("Docker Action");

      // Verify they are snippets
      const nodeSnippet = completions.find(c => c.label === "Node.js Action");
      expect(nodeSnippet?.kind).toBe(15); // CompletionItemKind.Snippet
      expect(nodeSnippet?.insertTextFormat).toBe(2); // InsertTextFormat.Snippet
    });

    it("offers full scaffolding snippets when no name or description exists", async () => {
      const [doc, position] = createActionDocument(`author: me
|`);
      const completions = await complete(doc, position, scaffoldingConfig);

      const nodeSnippet = completions.find(c => c.label === "Node.js Action");
      expect(nodeSnippet).toBeDefined();
      // Full snippet should include name:
      expect((nodeSnippet?.textEdit as {newText: string})?.newText).toContain("name:");
    });

    it("offers runs-only snippets when name exists", async () => {
      const [doc, position] = createActionDocument(`name: My Action
|`);
      const completions = await complete(doc, position, scaffoldingConfig);

      const nodeSnippet = completions.find(c => c.label === "Node.js Action");
      expect(nodeSnippet).toBeDefined();
      // Runs-only snippet should start with inputs:, not name:
      expect((nodeSnippet?.textEdit as {newText: string})?.newText).toMatch(/^inputs:/);
      expect((nodeSnippet?.textEdit as {newText: string})?.newText).toContain("runs:");
    });

    it("offers runs-only snippets when description exists", async () => {
      const [doc, position] = createActionDocument(`description: Does something
|`);
      const completions = await complete(doc, position, scaffoldingConfig);

      const compositeSnippet = completions.find(c => c.label === "Composite Action");
      expect(compositeSnippet).toBeDefined();
      // Runs-only snippet should start with inputs:, not description:
      expect((compositeSnippet?.textEdit as {newText: string})?.newText).toMatch(/^inputs:/);
      expect((compositeSnippet?.textEdit as {newText: string})?.newText).toContain("runs:");
    });

    it("does not offer snippets when runs.using already exists", async () => {
      const [doc, position] = createActionDocument(`name: My Action
description: Test
runs:
  using: composite
  |`);
      const completions = await complete(doc, position, scaffoldingConfig);
      const labels = completions.map(c => c.label);

      expect(labels).not.toContain("Node.js Action");
      expect(labels).not.toContain("Composite Action");
      expect(labels).not.toContain("Docker Action");
    });

    it("offers snippets inside runs when using is not set", async () => {
      const [doc, position] = createActionDocument(`name: My Action
description: Test
runs:
  |`);
      const completions = await complete(doc, position, scaffoldingConfig);
      const labels = completions.map(c => c.label);

      expect(labels).toContain("Node.js Action");
      expect(labels).toContain("Composite Action");
      expect(labels).toContain("Docker Action");
    });

    it("does not offer snippets at root level when runs exists", async () => {
      const [doc, position] = createActionDocument(`name: My Action
description: Test
runs:
  steps: []
|`);
      const completions = await complete(doc, position, scaffoldingConfig);
      const labels = completions.map(c => c.label);

      expect(labels).not.toContain("Node.js Action");
      expect(labels).not.toContain("Composite Action");
      expect(labels).not.toContain("Docker Action");
    });

    it("does not offer snippets when nested inside runs steps", async () => {
      const [doc, position] = createActionDocument(`name: My Action
description: Test
runs:
  using: composite
  steps:
    - |`);
      const completions = await complete(doc, position, scaffoldingConfig);
      const labels = completions.map(c => c.label);

      expect(labels).not.toContain("Node.js Action");
      expect(labels).not.toContain("Composite Action");
      expect(labels).not.toContain("Docker Action");
    });

    it("Node.js snippet contains expected content", async () => {
      const [doc, position] = createActionDocument(`|`);
      const completions = await complete(doc, position, scaffoldingConfig);

      const nodeSnippet = completions.find(c => c.label === "Node.js Action");
      const text = (nodeSnippet?.textEdit as {newText: string})?.newText;

      expect(text).toContain("using: node24");
      expect(text).toContain("main:");
      expect(text).toContain("inputs:");
      expect(text).toContain("outputs:");
    });

    it("Composite snippet contains expected content", async () => {
      const [doc, position] = createActionDocument(`|`);
      const completions = await complete(doc, position, scaffoldingConfig);

      const compositeSnippet = completions.find(c => c.label === "Composite Action");
      const text = (compositeSnippet?.textEdit as {newText: string})?.newText;

      expect(text).toContain("using: composite");
      expect(text).toContain("steps:");
      expect(text).toContain("shell: bash");
    });

    it("Docker snippet contains expected content", async () => {
      const [doc, position] = createActionDocument(`|`);
      const completions = await complete(doc, position, scaffoldingConfig);

      const dockerSnippet = completions.find(c => c.label === "Docker Action");
      const text = (dockerSnippet?.textEdit as {newText: string})?.newText;

      expect(text).toContain("using: docker");
      expect(text).toContain("image:");
      expect(text).toContain("entrypoint:");
    });

    it("does not offer snippets when feature flag is disabled", async () => {
      const [doc, position] = createActionDocument(`|`);
      const completions = await complete(doc, position);
      const labels = completions.map(c => c.label);

      expect(labels).not.toContain("Node.js Action");
      expect(labels).not.toContain("Composite Action");
      expect(labels).not.toContain("Docker Action");
    });
  });
});
