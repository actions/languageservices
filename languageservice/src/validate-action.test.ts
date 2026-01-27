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

    it("reports error for node24 action missing main", async () => {
      const doc = createActionDocument(`
name: My Action
description: Invalid - node24 without main
runs:
  using: node24
  pre: setup.js
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message === "'main' is required for Node.js actions (using: node24)")).toBe(true);
      // Should NOT have duplicate schema error
      expect(diagnostics.filter(d => d.message.includes("main")).length).toBe(1);
    });

    it("reports error for node24 action with only using (no narrowing key)", async () => {
      const doc = createActionDocument(`
name: My Action
description: Invalid - node24 without main
runs:
  using: node24
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message === "'main' is required for Node.js actions (using: node24)")).toBe(true);
      // Should NOT have the generic "not enough info" schema error
      expect(diagnostics.some(d => d.message.includes("There's not enough info"))).toBe(false);
    });

    it("reports error for composite action missing steps", async () => {
      const doc = createActionDocument(`
name: My Action
description: Invalid - composite without steps
runs:
  using: composite
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message === "'steps' is required for composite actions (using: composite)")).toBe(
        true
      );
      // Should NOT have duplicate schema error
      expect(diagnostics.some(d => d.message.includes("There's not enough info"))).toBe(false);
    });

    it("reports error for docker action missing image", async () => {
      const doc = createActionDocument(`
name: My Action
description: Invalid - docker without image
runs:
  using: docker
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message === "'image' is required for Docker actions (using: docker)")).toBe(true);
      // Should NOT have duplicate schema error
      expect(diagnostics.some(d => d.message.includes("There's not enough info"))).toBe(false);
    });

    it("reports error for docker action with entrypoint but missing image", async () => {
      const doc = createActionDocument(`
name: My Action
description: Invalid - docker without image
runs:
  using: docker
  entrypoint: /entrypoint.sh
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message === "'image' is required for Docker actions (using: docker)")).toBe(true);
      // Should NOT have duplicate "Required property is missing: image" schema error
      expect(diagnostics.filter(d => d.message.includes("image")).length).toBe(1);
    });

    it("lets schema handle missing using", async () => {
      const doc = createActionDocument(`
name: My Action
description: Invalid - no using
runs:
  main: index.js
`);
      const diagnostics = await validate(doc);
      // Should have schema error about not enough info or unexpected value
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should NOT have custom validation error (can't determine action type)
      expect(diagnostics.some(d => d.message.includes("is required for"))).toBe(false);
    });

    it("lets schema handle invalid using value", async () => {
      const doc = createActionDocument(`
name: My Action
description: Invalid - bad using value
runs:
  using: not-supported
  main: index.js
`);
      const diagnostics = await validate(doc);
      // Should have schema error about unexpected value
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should NOT have custom validation error (unknown action type)
      expect(diagnostics.some(d => d.message.includes("is required for"))).toBe(false);
      expect(diagnostics.some(d => d.message.includes("is not valid for"))).toBe(false);
    });
  });

  describe("composite step uses format validation", () => {
    it("validates valid uses format with version", async () => {
      const doc = createActionDocument(`
name: My Action
description: Uses another action
runs:
  using: composite
  steps:
    - uses: actions/checkout@v4
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "invalid-uses-format")).toBe(false);
    });

    it("validates docker:// uses format", async () => {
      const doc = createActionDocument(`
name: My Action
description: Uses docker image
runs:
  using: composite
  steps:
    - uses: docker://alpine:3.14
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "invalid-uses-format")).toBe(false);
    });

    it("validates local ./ uses format", async () => {
      const doc = createActionDocument(`
name: My Action
description: Uses local action
runs:
  using: composite
  steps:
    - uses: ./local-action
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "invalid-uses-format")).toBe(false);
    });

    it("errors on missing @ref", async () => {
      const doc = createActionDocument(`
name: My Action
description: Missing version
runs:
  using: composite
  steps:
    - uses: actions/checkout
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "invalid-uses-format")).toBe(true);
      expect(diagnostics.some(d => d.message.includes("Expected format"))).toBe(true);
    });

    it("errors on invalid format", async () => {
      const doc = createActionDocument(`
name: My Action
description: Invalid format
runs:
  using: composite
  steps:
    - uses: invalid-format
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "invalid-uses-format")).toBe(true);
    });

    it("warns on short SHA", async () => {
      const doc = createActionDocument(`
name: My Action
description: Short SHA
runs:
  using: composite
  steps:
    - uses: actions/checkout@a1b2c3d
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "short-sha-ref")).toBe(true);
      expect(diagnostics.some(d => d.message.includes("shortened commit SHA"))).toBe(true);
    });

    it("allows full SHA", async () => {
      const doc = createActionDocument(`
name: My Action
description: Full SHA
runs:
  using: composite
  steps:
    - uses: actions/checkout@a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "short-sha-ref")).toBe(false);
    });

    it("errors on reusable workflow in step uses", async () => {
      const doc = createActionDocument(`
name: My Action
description: Wrong workflow reference
runs:
  using: composite
  steps:
    - uses: owner/repo/.github/workflows/build.yml@main
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message.includes("Reusable workflows should be referenced"))).toBe(true);
    });
  });

  describe("composite step if literal text validation", () => {
    it("errors when literal text mixed with embedded expression", async () => {
      const doc = createActionDocument(`
name: My Action
description: Literal text in if
runs:
  using: composite
  steps:
    - if: push == \${{ github.event_name }}
      run: echo hi
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "expression-literal-text-in-condition")).toBe(true);
      expect(diagnostics.some(d => d.message.includes("literal text outside replacement tokens"))).toBe(true);
    });

    it("allows valid expression in if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Valid if expression
runs:
  using: composite
  steps:
    - if: \${{ github.event_name == 'push' }}
      run: echo hi
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "expression-literal-text-in-condition")).toBe(false);
    });

    it("allows if without expression markers (auto-wrapped)", async () => {
      const doc = createActionDocument(`
name: My Action
description: If without markers
runs:
  using: composite
  steps:
    - if: github.event_name == 'push'
      run: echo hi
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "expression-literal-text-in-condition")).toBe(false);
    });

    it("allows success() function", async () => {
      const doc = createActionDocument(`
name: My Action
description: Success function
runs:
  using: composite
  steps:
    - if: success()
      run: echo hi
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "expression-literal-text-in-condition")).toBe(false);
    });

    it("errors on format with literal text in if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Format with literal text
runs:
  using: composite
  steps:
    - if: \${{ format('event is {0}', github.event_name) }}
      run: echo hi
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "expression-literal-text-in-condition")).toBe(true);
    });

    it("allows format with only replacement tokens", async () => {
      const doc = createActionDocument(`
name: My Action
description: Format with only tokens
runs:
  using: composite
  steps:
    - if: \${{ format('{0}', github.event_name) }}
      run: echo hi
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "expression-literal-text-in-condition")).toBe(false);
    });

    it("validates if in uses-step", async () => {
      const doc = createActionDocument(`
name: My Action
description: If in uses step
runs:
  using: composite
  steps:
    - if: push == \${{ github.event_name }}
      uses: actions/checkout@v4
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "expression-literal-text-in-condition")).toBe(true);
    });
  });

  describe("pre-if and post-if validation", () => {
    it("errors on explicit expression with literal text in pre-if for node action", async () => {
      const doc = createActionDocument(`
name: My Action
description: Literal text in pre-if
runs:
  using: node20
  main: index.js
  pre: setup.js
  pre-if: push == \${{ github.event_name }}
`);
      const diagnostics = await validate(doc);
      // Explicit ${{ }} syntax is not allowed for pre-if, so we get that error
      expect(diagnostics.some(d => d.code === "explicit-expression-not-allowed")).toBe(true);
    });

    it("errors on explicit expression with literal text in post-if for node action", async () => {
      const doc = createActionDocument(`
name: My Action
description: Literal text in post-if
runs:
  using: node20
  main: index.js
  post: cleanup.js
  post-if: event == \${{ github.event_name }}
`);
      const diagnostics = await validate(doc);
      // Explicit ${{ }} syntax is not allowed for post-if, so we get that error
      expect(diagnostics.some(d => d.code === "explicit-expression-not-allowed")).toBe(true);
    });

    it("errors on explicit expression with literal text in pre-if for docker action", async () => {
      const doc = createActionDocument(`
name: My Action
description: Literal text in pre-if
runs:
  using: docker
  image: Dockerfile
  pre-entrypoint: /setup.sh
  pre-if: push == \${{ github.event_name }}
`);
      const diagnostics = await validate(doc);
      // Explicit ${{ }} syntax is not allowed for pre-if, so we get that error
      expect(diagnostics.some(d => d.code === "explicit-expression-not-allowed")).toBe(true);
    });

    it("errors on explicit expression with literal text in post-if for docker action", async () => {
      const doc = createActionDocument(`
name: My Action
description: Literal text in post-if
runs:
  using: docker
  image: Dockerfile
  post-entrypoint: /cleanup.sh
  post-if: event == \${{ github.event_name }}
`);
      const diagnostics = await validate(doc);
      // Explicit ${{ }} syntax is not allowed for post-if, so we get that error
      expect(diagnostics.some(d => d.code === "explicit-expression-not-allowed")).toBe(true);
    });

    it("allows valid expression in pre-if for node action", async () => {
      const doc = createActionDocument(`
name: My Action
description: Valid pre-if
runs:
  using: node20
  main: index.js
  pre: setup.js
  pre-if: success()
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "expression-literal-text-in-condition")).toBe(false);
    });

    it("allows valid expression in post-if for node action", async () => {
      const doc = createActionDocument(`
name: My Action
description: Valid post-if
runs:
  using: node20
  main: index.js
  post: cleanup.js
  post-if: always()
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "expression-literal-text-in-condition")).toBe(false);
    });

    it("errors on explicit expression syntax in pre-if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Explicit expression in pre-if
runs:
  using: node20
  main: index.js
  pre: setup.js
  pre-if: \${{ runner.os == 'Windows' }}
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "explicit-expression-not-allowed")).toBe(true);
      expect(diagnostics.some(d => d.message.includes("pre-if"))).toBe(true);
    });

    it("errors on explicit expression syntax in post-if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Explicit expression in post-if
runs:
  using: node20
  main: index.js
  post: cleanup.js
  post-if: \${{ always() }}
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "explicit-expression-not-allowed")).toBe(true);
      expect(diagnostics.some(d => d.message.includes("post-if"))).toBe(true);
    });

    it("allows expression with failure() in post-if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Valid post-if
runs:
  using: node20
  main: index.js
  post: cleanup.js
  post-if: failure()
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "expression-literal-text-in-condition")).toBe(false);
    });

    it("allows expression with cancelled() in post-if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Valid post-if
runs:
  using: node20
  main: index.js
  post: cleanup.js
  post-if: cancelled()
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "expression-literal-text-in-condition")).toBe(false);
    });
  });

  describe("format string validation", () => {
    it("errors on format() with too few arguments in composite step if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Format mismatch
runs:
  using: composite
  steps:
    - if: format('{0} {1}', 'only-one')
      run: echo hi
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "format-arg-count-mismatch")).toBe(true);
    });

    it("errors on invalid format string in composite step if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Invalid format
runs:
  using: composite
  steps:
    - if: format('{', 'arg')
      run: echo hi
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "invalid-format-string")).toBe(true);
    });

    it("errors on format() with too few arguments in pre-if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Format mismatch in pre-if
runs:
  using: node20
  main: index.js
  pre: setup.js
  pre-if: format('{0} {1}', 'only-one')
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "format-arg-count-mismatch")).toBe(true);
    });

    it("errors on format() with too few arguments in post-if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Format mismatch in post-if
runs:
  using: node20
  main: index.js
  post: cleanup.js
  post-if: format('{0} {1} {2}', 'a', 'b')
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "format-arg-count-mismatch")).toBe(true);
    });

    it("allows valid format() call in composite step if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Valid format
runs:
  using: composite
  steps:
    - if: format('{0} {1}', 'a', 'b') == 'a b'
      run: echo hi
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "format-arg-count-mismatch")).toBe(false);
      expect(diagnostics.some(d => d.code === "invalid-format-string")).toBe(false);
    });

    it("allows valid format() call in pre-if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Valid format in pre-if
runs:
  using: node20
  main: index.js
  pre: setup.js
  pre-if: format('{0}', runner.os) == 'Linux'
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "format-arg-count-mismatch")).toBe(false);
      expect(diagnostics.some(d => d.code === "invalid-format-string")).toBe(false);
    });

    it("errors on format() with too few arguments in run expression", async () => {
      const doc = createActionDocument(`
name: My Action
description: Format mismatch in run
runs:
  using: composite
  steps:
    - run: echo \${{ format('{0} {1}', 'only-one') }}
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "format-arg-count-mismatch")).toBe(true);
    });

    it("errors on format() with too few arguments in input default", async () => {
      const doc = createActionDocument(`
name: My Action
description: Format mismatch in input default
inputs:
  greeting:
    description: Greeting message
    default: \${{ format('{0} {1}', 'hello') }}
runs:
  using: node20
  main: index.js
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.code === "format-arg-count-mismatch")).toBe(true);
    });
  });

  describe("if condition context validation", () => {
    it("warns on unknown context in composite step if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Unknown context in if
runs:
  using: composite
  steps:
    - if: foo == bar
      run: echo hi
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message.includes("Unrecognized named-value"))).toBe(true);
    });

    it("warns on unknown context in pre-if for node action", async () => {
      const doc = createActionDocument(`
name: My Action
description: Unknown context in pre-if
runs:
  using: node20
  main: index.js
  pre: setup.js
  pre-if: foo == bar
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message.includes("Unrecognized named-value"))).toBe(true);
    });

    it("warns on unknown context in post-if for node action", async () => {
      const doc = createActionDocument(`
name: My Action
description: Unknown context in post-if
runs:
  using: node20
  main: index.js
  post: cleanup.js
  post-if: foo == bar
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message.includes("Unrecognized named-value"))).toBe(true);
    });

    it("warns on unknown context in pre-if for docker action", async () => {
      const doc = createActionDocument(`
name: My Action
description: Unknown context in pre-if
runs:
  using: docker
  image: Dockerfile
  pre-entrypoint: /setup.sh
  pre-if: foo == bar
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message.includes("Unrecognized named-value"))).toBe(true);
    });

    it("warns on unknown context in post-if for docker action", async () => {
      const doc = createActionDocument(`
name: My Action
description: Unknown context in post-if
runs:
  using: docker
  image: Dockerfile
  post-entrypoint: /cleanup.sh
  post-if: foo == bar
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message.includes("Unrecognized named-value"))).toBe(true);
    });

    it("allows valid contexts in composite step if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Valid context in if
runs:
  using: composite
  steps:
    - if: github.event_name == 'push'
      run: echo hi
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message.includes("Unrecognized named-value"))).toBe(false);
    });

    it("allows valid contexts in pre-if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Valid context in pre-if
runs:
  using: node20
  main: index.js
  pre: setup.js
  pre-if: runner.os == 'Linux'
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message.includes("Unrecognized named-value"))).toBe(false);
    });

    it("allows valid contexts in post-if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Valid context in post-if
runs:
  using: node20
  main: index.js
  post: cleanup.js
  post-if: runner.os == 'Linux'
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message.includes("Unrecognized named-value"))).toBe(false);
    });

    it("allows hashFiles function in composite step if", async () => {
      const doc = createActionDocument(`
name: My Action
description: hashFiles in if
runs:
  using: composite
  steps:
    - if: hashFiles('**/package-lock.json') != ''
      run: echo hi
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message.includes("Unrecognized"))).toBe(false);
    });

    it("allows success, failure, always, cancelled functions in composite step if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Status functions in if
runs:
  using: composite
  steps:
    - if: success() && !cancelled()
      run: echo success
      shell: bash
    - if: failure()
      run: echo failure
      shell: bash
    - if: always()
      run: echo always
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message.includes("Unrecognized"))).toBe(false);
    });

    it("allows hashFiles function in pre-if", async () => {
      const doc = createActionDocument(`
name: My Action
description: hashFiles in pre-if
runs:
  using: node20
  main: index.js
  pre: setup.js
  pre-if: hashFiles('**/package-lock.json') != ''
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message.includes("Unrecognized"))).toBe(false);
    });

    it("allows status functions in post-if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Status functions in post-if
runs:
  using: node20
  main: index.js
  post: cleanup.js
  post-if: always() || failure()
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message.includes("Unrecognized"))).toBe(false);
    });

    it("errors on unknown function in composite step if", async () => {
      const doc = createActionDocument(`
name: My Action
description: Unknown function in if
runs:
  using: composite
  steps:
    - if: unknownFunc()
      run: echo hi
      shell: bash
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message.includes("Unrecognized function"))).toBe(true);
    });

    it("errors on unknown function in pre-if for node action", async () => {
      const doc = createActionDocument(`
name: My Action
description: Unknown function in pre-if
runs:
  using: node20
  main: index.js
  pre: setup.js
  pre-if: unknownFunc()
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message.includes("Unrecognized function"))).toBe(true);
    });

    it("errors on unknown function in post-if for node action", async () => {
      const doc = createActionDocument(`
name: My Action
description: Unknown function in post-if
runs:
  using: node20
  main: index.js
  post: cleanup.js
  post-if: unknownFunc()
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message.includes("Unrecognized function"))).toBe(true);
    });

    it("errors on unknown function in pre-if for docker action", async () => {
      const doc = createActionDocument(`
name: My Action
description: Unknown function in pre-if
runs:
  using: docker
  image: Dockerfile
  pre-entrypoint: /setup.sh
  pre-if: unknownFunc()
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message.includes("Unrecognized function"))).toBe(true);
    });

    it("errors on unknown function in post-if for docker action", async () => {
      const doc = createActionDocument(`
name: My Action
description: Unknown function in post-if
runs:
  using: docker
  image: Dockerfile
  post-entrypoint: /cleanup.sh
  post-if: unknownFunc()
`);
      const diagnostics = await validate(doc);
      expect(diagnostics.some(d => d.message.includes("Unrecognized function"))).toBe(true);
    });
  });
});
