import {TextDocument} from "vscode-languageserver-textdocument";
import {validate} from "./validate";
import {clearCache} from "./utils/workflow-cache.js";

describe("validate action files", () => {
  beforeEach(() => {
    clearCache();
  });

  function createActionDocument(content: string, uri = "file:///test/action.yml"): TextDocument {
    return TextDocument.create(uri, "yaml", 1, content);
  }

  describe("valid action files", () => {
    it("validates a minimal composite action", async () => {
      const doc = createActionDocument(`
name: My Action
description: Does something
runs:
  using: composite
  steps:
    - run: echo "Hello"
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics).toEqual([]);
    });

    it("validates a node20 action", async () => {
      const doc = createActionDocument(`
name: My Action
description: A JavaScript action
runs:
  using: node20
  main: index.js
`);
      const diagnostics = await validate(doc);
      expect(diagnostics).toEqual([]);
    });

    it("validates a docker action", async () => {
      const doc = createActionDocument(`
name: My Action
description: A Docker action
runs:
  using: docker
  image: Dockerfile
`);
      const diagnostics = await validate(doc);
      expect(diagnostics).toEqual([]);
    });

    it("validates an action with inputs and outputs", async () => {
      const doc = createActionDocument(`
name: My Action
description: Action with I/O
inputs:
  name:
    description: The name to greet
    required: true
  greeting:
    description: The greeting
    default: Hello
outputs:
  result:
    description: The greeting result
runs:
  using: composite
  steps:
    - run: echo "$\{{ inputs.greeting }} $\{{ inputs.name }}"
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics).toEqual([]);
    });

    it("validates an action with branding", async () => {
      const doc = createActionDocument(`
name: My Action
description: Branded action
branding:
  icon: activity
  color: blue
runs:
  using: node20
  main: index.js
`);
      const diagnostics = await validate(doc);
      expect(diagnostics).toEqual([]);
    });
  });

  describe("invalid action files", () => {
    it("reports error for missing required name", async () => {
      const doc = createActionDocument(`
description: An action without a name
runs:
  using: composite
  steps:
    - run: echo "Hi"
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("name");
    });

    it("reports error for missing required description", async () => {
      const doc = createActionDocument(`
name: My Action
runs:
  using: composite
  steps:
    - run: echo "Hi"
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("description");
    });

    it("reports error for missing runs", async () => {
      const doc = createActionDocument(`
name: My Action
description: An action without runs
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("runs");
    });

    it("reports error for missing using in runs", async () => {
      const doc = createActionDocument(`
name: My Action
description: Missing using
runs:
  main: index.js
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("using");
    });

    it("reports error for invalid branding icon", async () => {
      const doc = createActionDocument(`
name: My Action
description: Bad icon
branding:
  icon: not-a-real-icon
  color: blue
runs:
  using: node20
  main: index.js
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("not-a-real-icon");
    });

    it("reports error for invalid branding color", async () => {
      const doc = createActionDocument(`
name: My Action
description: Bad color
branding:
  icon: activity
  color: pink
runs:
  using: node20
  main: index.js
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("pink");
    });

    it("reports error for composite step missing shell", async () => {
      const doc = createActionDocument(`
name: My Action
description: Missing shell
runs:
  using: composite
  steps:
    - run: echo "Hi"
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("shell");
    });

    it("reports error for invalid YAML syntax", async () => {
      const doc = createActionDocument(`
name: My Action
description: Bad YAML
runs:
  using: composite
  steps:
    - run: |
      echo "Bad indentation"
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe("document type routing", () => {
    it("routes action.yml to action validation", async () => {
      const doc = createActionDocument(
        `
name: Test
description: Test
runs:
  using: node20
  main: index.js
`,
        "file:///my-repo/action.yml"
      );
      const diagnostics = await validate(doc);
      expect(diagnostics).toEqual([]);
    });

    it("routes action.yaml to action validation", async () => {
      const doc = createActionDocument(
        `
name: Test
description: Test
runs:
  using: node20
  main: index.js
`,
        "file:///my-repo/action.yaml"
      );
      const diagnostics = await validate(doc);
      expect(diagnostics).toEqual([]);
    });

    it("routes nested action.yml to action validation", async () => {
      const doc = createActionDocument(
        `
name: Test
description: Test
runs:
  using: composite
  steps:
    - run: echo test
      shell: bash
`,
        "file:///my-repo/.github/actions/my-action/action.yml"
      );
      const diagnostics = await validate(doc);
      expect(diagnostics).toEqual([]);
    });
  });

  describe("composite action step validation", () => {
    it("validates action inputs in composite action uses steps", async () => {
      const doc = createActionDocument(`
name: My Composite Action
description: A composite action with uses steps
runs:
  using: composite
  steps:
    - uses: actions/checkout@v4
      with:
        invalid-input: value
`);
      const mockMetadataProvider = {
        fetchActionMetadata: () =>
          Promise.resolve({
            name: "Checkout",
            description: "Checkout a repo",
            inputs: {
              repository: {description: "Repository name", required: false},
              ref: {description: "Branch or tag", required: false}
            }
          })
      };
      const diagnostics = await validate(doc, {actionsMetadataProvider: mockMetadataProvider});
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("invalid-input");
    });

    it("validates required inputs in composite action uses steps", async () => {
      const doc = createActionDocument(`
name: My Composite Action
description: A composite action with uses steps
runs:
  using: composite
  steps:
    - uses: actions/some-action@v1
`);
      const mockMetadataProvider = {
        fetchActionMetadata: () =>
          Promise.resolve({
            name: "Some Action",
            description: "An action with required inputs",
            inputs: {
              "required-input": {description: "A required input", required: true}
            }
          })
      };
      const diagnostics = await validate(doc, {actionsMetadataProvider: mockMetadataProvider});
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("required-input");
    });

    it("reports unresolved action in composite action uses steps", async () => {
      const doc = createActionDocument(`
name: My Composite Action
description: A composite action with uses steps
runs:
  using: composite
  steps:
    - uses: actions/nonexistent@v1
`);
      const mockMetadataProvider = {
        fetchActionMetadata: () => Promise.resolve(undefined)
      };
      const diagnostics = await validate(doc, {actionsMetadataProvider: mockMetadataProvider});
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].message).toContain("Unable to resolve action");
    });

    it("passes validation for valid composite action uses steps", async () => {
      const doc = createActionDocument(`
name: My Composite Action
description: A composite action with uses steps
runs:
  using: composite
  steps:
    - uses: actions/checkout@v4
      with:
        repository: owner/repo
`);
      const mockMetadataProvider = {
        fetchActionMetadata: () =>
          Promise.resolve({
            name: "Checkout",
            description: "Checkout a repo",
            inputs: {
              repository: {description: "Repository name", required: false},
              ref: {description: "Branch or tag", required: false}
            }
          })
      };
      const diagnostics = await validate(doc, {actionsMetadataProvider: mockMetadataProvider});
      expect(diagnostics).toEqual([]);
    });
  });

  describe("invalid key combinations based on using type", () => {
    it("reports error for node20 action with steps", async () => {
      const doc = createActionDocument(`
name: My Action
description: Invalid - node20 with steps
runs:
  using: node20
  main: index.js
  steps:
    - run: echo "hello"
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.length).toBeGreaterThan(0);
      // Schema reports "Unexpected value 'steps'" for invalid keys
      expect(diagnostics.some(d => d.message.includes("steps"))).toBe(true);
    });

    it("reports error for composite action with main", async () => {
      const doc = createActionDocument(`
name: My Action
description: Invalid - composite with main
runs:
  using: composite
  steps:
    - run: echo "hello"
      shell: bash
  main: index.js
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.length).toBeGreaterThan(0);
      // Schema reports "Unexpected value 'main'" for invalid keys
      expect(diagnostics.some(d => d.message.includes("main"))).toBe(true);
    });

    it("reports error for docker action with steps", async () => {
      const doc = createActionDocument(`
name: My Action
description: Invalid - docker with steps
runs:
  using: docker
  image: Dockerfile
  steps:
    - run: echo "hello"
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.length).toBeGreaterThan(0);
      // Schema reports "Unexpected value 'steps'" for invalid keys
      expect(diagnostics.some(d => d.message.includes("steps"))).toBe(true);
    });

    it("reports error for docker action with main", async () => {
      const doc = createActionDocument(`
name: My Action
description: Invalid - docker with main
runs:
  using: docker
  image: Dockerfile
  main: index.js
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.length).toBeGreaterThan(0);
      // Schema reports "Unexpected value 'main'" for invalid keys
      expect(diagnostics.some(d => d.message.includes("main"))).toBe(true);
    });

    it("reports error for node20 action missing main", async () => {
      const doc = createActionDocument(`
name: My Action
description: Invalid - node20 without main
runs:
  using: node20
  pre: setup.js
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics.some(d => d.message.includes("main"))).toBe(true);
    });
  });
});
