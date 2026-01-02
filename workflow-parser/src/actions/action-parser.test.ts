import {parseAction} from "./action-parser.js";
import {convertActionTemplate} from "./action-template.js";
import {nullTrace} from "../test-utils/null-trace.js";

describe("parseAction", () => {
  it("parses a minimal action.yml", () => {
    const content = `
name: My Action
description: A simple action
runs:
  using: composite
  steps:
    - run: echo Hello
      shell: bash`;

    const result = parseAction({name: "action.yml", content}, nullTrace);

    expect(result.context.errors.count).toBe(0);
    expect(result.value).toBeDefined();
  });

  it("parses a JavaScript action", () => {
    const content = `
name: JS Action
description: A JavaScript action
runs:
  using: node20
  main: dist/index.js
  pre: dist/setup.js
  post: dist/cleanup.js`;

    const result = parseAction({name: "action.yml", content}, nullTrace);

    expect(result.context.errors.count).toBe(0);
    expect(result.value).toBeDefined();
  });

  it("parses a Docker action", () => {
    const content = `
name: Docker Action
description: A Docker action
runs:
  using: docker
  image: Dockerfile
  args:
    - \${{ inputs.name }}
  env:
    DEBUG: "true"`;

    const result = parseAction({name: "action.yml", content}, nullTrace);

    expect(result.context.errors.count).toBe(0);
    expect(result.value).toBeDefined();
  });

  it("parses action with inputs and outputs", () => {
    const content = `
name: Action with I/O
description: Action with inputs and outputs
inputs:
  name:
    description: The name to greet
    required: true
    default: World
  verbose:
    description: Enable verbose mode
    required: false
outputs:
  greeting:
    description: The greeting message
    value: \${{ steps.greet.outputs.message }}
runs:
  using: composite
  steps:
    - id: greet
      run: echo "::set-output name=message::Hello \${{ inputs.name }}"
      shell: bash`;

    const result = parseAction({name: "action.yml", content}, nullTrace);

    expect(result.context.errors.count).toBe(0);
    expect(result.value).toBeDefined();
  });

  it("parses action with branding", () => {
    const content = `
name: Branded Action
description: Action with branding
branding:
  icon: award
  color: blue
runs:
  using: composite
  steps:
    - run: echo Hello
      shell: bash`;

    const result = parseAction({name: "action.yml", content}, nullTrace);

    expect(result.context.errors.count).toBe(0);
    expect(result.value).toBeDefined();
  });

  it("reports error for invalid YAML", () => {
    const content = `
name: Invalid Action
description: Action with bad YAML
runs:
  using: composite
  steps:
    - name: 'Hello \${{ fromJSON('test') }}'
      run: echo test
      shell: bash`;

    const result = parseAction({name: "action.yml", content}, nullTrace);

    expect(result.context.errors.count).toBeGreaterThan(0);
    expect(result.value).toBeUndefined();
  });

  it("validates required fields", () => {
    const content = `
runs:
  using: composite
  steps:
    - run: echo Hello
      shell: bash`;

    const result = parseAction({name: "action.yml", content}, nullTrace);

    expect(result.context.errors.count).toBeGreaterThan(0);
  });

  it("validates shell is required for run steps", () => {
    const content = `
name: Missing Shell
description: Action without shell in run step
runs:
  using: composite
  steps:
    - run: echo Hello`;

    const result = parseAction({name: "action.yml", content}, nullTrace);

    expect(result.context.errors.count).toBeGreaterThan(0);
  });

  it("validates branding icon values", () => {
    const content = `
name: Bad Icon
description: Action with invalid branding icon
branding:
  icon: invalid-icon-name
  color: blue
runs:
  using: composite
  steps:
    - run: echo Hello
      shell: bash`;

    const result = parseAction({name: "action.yml", content}, nullTrace);

    // Should have error for invalid icon value
    expect(result.context.errors.count).toBeGreaterThan(0);
  });

  it("validates branding color values", () => {
    const content = `
name: Bad Color
description: Action with invalid branding color
branding:
  icon: award
  color: pink
runs:
  using: composite
  steps:
    - run: echo Hello
      shell: bash`;

    const result = parseAction({name: "action.yml", content}, nullTrace);

    // Should have error for invalid color value
    expect(result.context.errors.count).toBeGreaterThan(0);
  });
});

describe("convertActionTemplate", () => {
  it("converts a composite action", () => {
    const content = `
name: Composite Action
description: A composite action
author: Test Author
inputs:
  name:
    description: The name
    required: true
    default: World
outputs:
  result:
    description: The result
    value: \${{ steps.main.outputs.result }}
runs:
  using: composite
  steps:
    - id: main
      name: Main step
      run: echo Hello \${{ inputs.name }}
      shell: bash
branding:
  icon: star
  color: green`;

    const result = parseAction({name: "action.yml", content}, nullTrace);
    expect(result.value).toBeDefined();
    if (!result.value) return;

    const template = convertActionTemplate(result.context, result.value);

    expect(template.name).toBe("Composite Action");
    expect(template.description).toBe("A composite action");
    expect(template.author).toBe("Test Author");
    expect(template.inputs).toHaveLength(1);
    expect(template.inputs?.[0].id).toBe("name");
    expect(template.inputs?.[0].required).toBe(true);
    expect(template.outputs).toHaveLength(1);
    expect(template.outputs?.[0].id).toBe("result");
    expect(template.runs.using).toBe("composite");
    expect(template.branding?.icon).toBe("star");
    expect(template.branding?.color).toBe("green");

    if (template.runs.using === "composite") {
      expect(template.runs.steps).toHaveLength(1);
      expect("run" in template.runs.steps[0]).toBe(true);
    }
  });

  it("converts a node action", () => {
    const content = `
name: Node Action
description: A node action
runs:
  using: node20
  main: dist/index.js
  pre: dist/setup.js
  pre-if: runner.os == 'Linux'
  post: dist/cleanup.js
  post-if: always()`;

    const result = parseAction({name: "action.yml", content}, nullTrace);
    expect(result.value).toBeDefined();
    if (!result.value) return;

    const template = convertActionTemplate(result.context, result.value);

    expect(template.runs.using).toBe("node20");
    if (template.runs.using === "node20") {
      expect(template.runs.main).toBe("dist/index.js");
      expect(template.runs.pre).toBe("dist/setup.js");
      expect(template.runs.preIf).toBe("runner.os == 'Linux'");
      expect(template.runs.post).toBe("dist/cleanup.js");
      expect(template.runs.postIf).toBe("always()");
    }
  });

  it("converts a docker action", () => {
    const content = `
name: Docker Action
description: A docker action
runs:
  using: docker
  image: Dockerfile
  entrypoint: /entrypoint.sh
  args:
    - --name
    - \${{ inputs.name }}
  env:
    DEBUG: "true"`;

    const result = parseAction({name: "action.yml", content}, nullTrace);
    expect(result.value).toBeDefined();
    if (!result.value) return;

    const template = convertActionTemplate(result.context, result.value);

    expect(template.runs.using).toBe("docker");
    if (template.runs.using === "docker") {
      expect(template.runs.image).toBe("Dockerfile");
      expect(template.runs.entrypoint).toBe("/entrypoint.sh");
      expect(template.runs.args).toEqual(["--name", "${{ inputs.name }}"]);
      expect(template.runs.env).toEqual({DEBUG: "true"});
    }
  });

  it("converts uses steps in composite action", () => {
    const content = `
name: Composite with Uses
description: Composite action with uses steps
runs:
  using: composite
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0`;

    const result = parseAction({name: "action.yml", content}, nullTrace);
    expect(result.value).toBeDefined();
    if (!result.value) return;

    const template = convertActionTemplate(result.context, result.value);

    if (template.runs.using === "composite") {
      expect(template.runs.steps).toHaveLength(1);
      const step = template.runs.steps[0];
      expect("uses" in step).toBe(true);
      if ("uses" in step) {
        expect(step.uses.value).toBe("actions/checkout@v4");
      }
    }
  });
});
