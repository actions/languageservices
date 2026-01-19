import {TemplateToken} from "@actions/workflow-parser/templates/tokens/index";
import {MappingToken} from "@actions/workflow-parser/templates/tokens/mapping-token";
import {Position} from "vscode-languageserver-textdocument";
import {CompletionItem, CompletionItemKind, InsertTextFormat, TextEdit} from "vscode-languageserver-types";
import {Value} from "./value-providers/config.js";

/**
 * Valid keys for each action type under the `runs:` section.
 * Source: https://github.com/actions/runner/blob/main/src/Runner.Worker/ActionManifestManager.cs
 */
const ACTION_NODE_KEYS = new Set(["using", "main", "pre", "post", "pre-if", "post-if"]);
const ACTION_COMPOSITE_KEYS = new Set(["using", "steps"]);
const ACTION_DOCKER_KEYS = new Set([
  "using",
  "image",
  "args",
  "env",
  "entrypoint",
  "pre-entrypoint",
  "pre-if",
  "post-entrypoint",
  "post-if"
]);

/**
 * Action scaffolding snippets.
 *
 * Full variants include name, description, inputs, outputs, and runs.
 * Runs-only variants include just the runs block.
 */
const ACTION_SNIPPET_NODEJS_FULL = `name: '\${1:Action Name}'
description: '\${2:What this action does}'

inputs:
  name:
    description: 'Name to greet'
    required: false
    default: 'World'

outputs:
  greeting:
    description: 'The greeting message'

runs:
  # For more on JavaScript actions (including @actions/toolkit), see:
  # https://docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-javascript-action
  using: node24
  main: index.js
  # Sample index.js (vanilla JS, no build required):
  #
  #   const fs = require('fs');
  #   const name = process.env.INPUT_NAME || 'World';
  #   const greeting = \\\`Hello \\\${name}\\\`;
  #   console.log(greeting);
  #   fs.appendFileSync(process.env.GITHUB_OUTPUT, \\\`greeting=\\\${greeting}\\\\n\\\`);
  #
  # For JavaScript actions with @actions/toolkit, see:
  # https://docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-javascript-action
`;

const ACTION_SNIPPET_NODEJS_RUNS = `inputs:
  name:
    description: 'Name to greet'
    required: false
    default: 'World'

outputs:
  greeting:
    description: 'The greeting message'

runs:
  # For more on JavaScript actions (including @actions/toolkit), see:
  # https://docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-javascript-action
  using: node24
  main: index.js
  # Sample index.js (vanilla JS, no build required):
  #
  #   const fs = require('fs');
  #   const name = process.env.INPUT_NAME || 'World';
  #   const greeting = \\\`Hello \\\${name}\\\`;
  #   console.log(greeting);
  #   fs.appendFileSync(process.env.GITHUB_OUTPUT, \\\`greeting=\\\${greeting}\\\\n\\\`);
`;

const ACTION_SNIPPET_NODEJS_USING = `# For more on JavaScript actions (including @actions/toolkit), see:
# https://docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-javascript-action
using: node24
main: index.js
# Sample index.js (vanilla JS, no build required):
#
#   console.log('Hello World');
`;

/* eslint-disable no-useless-escape -- \$ is required to escape $ in VS Code snippets */
const ACTION_SNIPPET_COMPOSITE_FULL = `name: '\${1:Action Name}'
description: '\${2:What this action does}'

inputs:
  name:
    description: 'Name to greet'
    required: false
    default: 'World'

outputs:
  greeting:
    description: 'The greeting message'
    value: \\\${{ steps.greet.outputs.greeting }}

runs:
  # For more on composite actions, see:
  # https://docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-composite-action
  using: composite
  steps:
    - id: greet
      shell: bash
      env:
        INPUT_NAME: \\\${{ inputs.name }}
      run: |
        GREETING="Hello \$INPUT_NAME"
        echo "\$GREETING"
        echo "greeting=\$GREETING" >> \$GITHUB_OUTPUT
`;

const ACTION_SNIPPET_COMPOSITE_RUNS = `inputs:
  name:
    description: 'Name to greet'
    required: false
    default: 'World'

outputs:
  greeting:
    description: 'The greeting message'
    value: \\\${{ steps.greet.outputs.greeting }}

runs:
  # For more on composite actions, see:
  # https://docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-composite-action
  using: composite
  steps:
    - id: greet
      shell: bash
      env:
        INPUT_NAME: \\\${{ inputs.name }}
      run: |
        GREETING="Hello \$INPUT_NAME"
        echo "\$GREETING"
        echo "greeting=\$GREETING" >> \$GITHUB_OUTPUT
`;

const ACTION_SNIPPET_COMPOSITE_USING = `# For more on composite actions, see:
# https://docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-composite-action
using: composite
steps:
  - shell: bash
    run: echo "Hello World"
`;

const ACTION_SNIPPET_DOCKER_FULL = `name: '\${1:Action Name}'
description: '\${2:What this action does}'

inputs:
  name:
    description: 'Name to greet'
    required: false
    default: 'World'

outputs:
  greeting:
    description: 'The greeting message'

runs:
  # For more on Docker actions, see:
  # https://docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-docker-container-action
  using: docker
  # 'docker://image:tag' uses pre-built image, 'Dockerfile' builds locally
  image: '\${3:docker://alpine:3.20}'
  env:
    INPUT_NAME: \\\${{ inputs.name }}
  entrypoint: '\${4:sh}'
  args:
    - -c
    - |
      GREETING="Hello \$INPUT_NAME"
      echo "\$GREETING"
      echo "greeting=\$GREETING" >> \$GITHUB_OUTPUT
`;

const ACTION_SNIPPET_DOCKER_RUNS = `inputs:
  name:
    description: 'Name to greet'
    required: false
    default: 'World'

outputs:
  greeting:
    description: 'The greeting message'

runs:
  # For more on Docker actions, see:
  # https://docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-docker-container-action
  using: docker
  # 'docker://image:tag' uses pre-built image, 'Dockerfile' builds locally
  image: '\${1:docker://alpine:3.20}'
  env:
    INPUT_NAME: \\\${{ inputs.name }}
  entrypoint: '\${2:sh}'
  args:
    - -c
    - |
      GREETING="Hello \$INPUT_NAME"
      echo "\$GREETING"
      echo "greeting=\$GREETING" >> \$GITHUB_OUTPUT
`;
/* eslint-enable no-useless-escape */

const ACTION_SNIPPET_DOCKER_USING = `# For more on Docker actions, see:
# https://docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-docker-container-action
using: docker
# 'docker://image:tag' uses pre-built image, 'Dockerfile' builds locally
image: '\${1:docker://alpine:3.20}'
entrypoint: '\${2:sh}'
args:
  - -c
  - echo "Hello World"
`;

/**
 * Filters action.yml `runs:` completions based on the `using:` value.
 *
 * When the user is completing keys under `runs:`:
 * - If `using: node20` is set, only show Node.js action keys
 * - If `using: composite` is set, only show composite action keys
 * - If `using: docker` is set, only show Docker action keys
 * - If `using:` is not set, show all keys but prioritize `using` first
 */
export function filterActionRunsCompletions(values: Value[], path: TemplateToken[], root: TemplateToken): Value[] {
  // Find the runs mapping from the root
  let runsMapping: MappingToken | undefined;
  if (root instanceof MappingToken) {
    for (let i = 0; i < root.count; i++) {
      const {key, value} = root.get(i);
      if (key.toString().toLowerCase() === "runs" && value instanceof MappingToken) {
        runsMapping = value;
        break;
      }
    }
  }
  if (!runsMapping) {
    return values;
  }

  // Check if the runs mapping is in our path (meaning we're completing inside it)
  const isInsideRuns = path.some(token => token === runsMapping);
  if (!isInsideRuns) {
    return values;
  }

  // Find where runsMapping is in the path
  const runsMappingIndex = path.indexOf(runsMapping);
  if (runsMappingIndex === -1) {
    return values;
  }

  // Check if there's anything after runsMapping in the path
  // If so, we're nested deeper (e.g., inside steps sequence or a step mapping)
  if (runsMappingIndex < path.length - 1) {
    return values;
  }

  // Get the using value from the runs mapping
  let usingValue: string | undefined;
  for (let i = 0; i < runsMapping.count; i++) {
    const {key, value} = runsMapping.get(i);
    if (key.toString().toLowerCase() === "using") {
      usingValue = value.toString();
      break;
    }
  }

  // Determine which keys to allow
  let allowedKeys: Set<string>;

  if (!usingValue) {
    // No using value set - show all keys but prioritize "using"
    return values.map(v => {
      if (v.label.toLowerCase() === "using") {
        return {...v, sortText: "9_using"}; // Sort after snippets (0_, 1_, 2_)
      }
      return v;
    });
  } else if (usingValue.match(/^node\d+$/i)) {
    allowedKeys = ACTION_NODE_KEYS;
  } else if (usingValue.toLowerCase() === "composite") {
    allowedKeys = ACTION_COMPOSITE_KEYS;
  } else if (usingValue.toLowerCase() === "docker") {
    allowedKeys = ACTION_DOCKER_KEYS;
  } else {
    // Unknown using value - show all
    return values;
  }

  // Filter to only allowed keys
  return values.filter(v => allowedKeys.has(v.label.toLowerCase()));
}

/**
 * Gets action scaffolding snippet completions for action.yml files.
 *
 * Returns snippet completions when `runs.using` is not present, offering
 * three action types: Node.js, Composite, and Docker.
 *
 * Three variants per type:
 * - "_FULL": Full scaffold with name, description, inputs, outputs, and runs
 * - "_RUNS": Inputs, outputs, and runs (when name/description already exists)
 * - "_USING": Minimal runs content (when inside `runs:` mapping)
 *
 * Which variant is shown depends on context:
 * - Inside `runs:` mapping → "_USING" variants
 * - At root with name/description → "_RUNS" variants
 * - At root without name/description → "_FULL" variants
 */
export function getActionScaffoldingSnippets(
  root: TemplateToken | undefined,
  path: TemplateToken[],
  position: Position
): CompletionItem[] {
  // Get the runs mapping from the root, if it exists
  let runsMapping: MappingToken | undefined;
  if (root instanceof MappingToken) {
    for (let i = 0; i < root.count; i++) {
      const {key, value} = root.get(i);
      if (key.toString().toLowerCase() === "runs" && value instanceof MappingToken) {
        runsMapping = value;
        break;
      }
    }
  }

  // Check if runs.using already exists - if so, no scaffolding needed
  if (runsMapping) {
    for (let i = 0; i < runsMapping.count; i++) {
      const {key} = runsMapping.get(i);
      if (key.toString().toLowerCase() === "using") {
        return [];
      }
    }
  }

  // Show "_USING" variants directly inside `runs`
  const runsMappingIndex = runsMapping ? path.indexOf(runsMapping) : -1;
  const isDirectlyInsideRuns = runsMappingIndex !== -1 && runsMappingIndex === path.length - 1;
  if (isDirectlyInsideRuns) {
    return [
      createSnippetCompletion(
        "Node.js Action",
        "Scaffold a Node.js action",
        ACTION_SNIPPET_NODEJS_USING,
        position,
        "0_nodejs"
      ),
      createSnippetCompletion(
        "Composite Action",
        "Scaffold a composite action",
        ACTION_SNIPPET_COMPOSITE_USING,
        position,
        "1_composite"
      ),
      createSnippetCompletion(
        "Docker Action",
        "Scaffold a Docker action",
        ACTION_SNIPPET_DOCKER_USING,
        position,
        "2_docker"
      )
    ];
  }

  // Not at root or `runs` already exists?
  const isAtRoot = path.length === 0 || (path.length === 1 && path[0] === root);
  if (!isAtRoot || runsMapping) {
    return [];
  }

  // Determine which variant to show based on existing root keys
  let hasNameOrDescription = false;
  if (root instanceof MappingToken) {
    for (let i = 0; i < root.count; i++) {
      const keyStr = root.get(i).key.toString().toLowerCase();
      if (keyStr === "name" || keyStr === "description") {
        hasNameOrDescription = true;
        break;
      }
    }
  }

  // Show "_RUNS" variants (inputs, outputs, and runs block)
  if (hasNameOrDescription) {
    return [
      createSnippetCompletion(
        "Node.js Action",
        "Scaffold a Node.js action",
        ACTION_SNIPPET_NODEJS_RUNS,
        position,
        "1_nodejs"
      ),
      createSnippetCompletion(
        "Composite Action",
        "Scaffold a composite action",
        ACTION_SNIPPET_COMPOSITE_RUNS,
        position,
        "2_composite"
      ),
      createSnippetCompletion(
        "Docker Action",
        "Scaffold a Docker action",
        ACTION_SNIPPET_DOCKER_RUNS,
        position,
        "3_docker"
      )
    ];
  }

  // Show "_FULL" variants (complete scaffold)
  return [
    createSnippetCompletion(
      "Node.js Action",
      "Scaffold a complete Node.js action",
      ACTION_SNIPPET_NODEJS_FULL,
      position,
      "1_nodejs"
    ),
    createSnippetCompletion(
      "Composite Action",
      "Scaffold a complete composite action",
      ACTION_SNIPPET_COMPOSITE_FULL,
      position,
      "2_composite"
    ),
    createSnippetCompletion(
      "Docker Action",
      "Scaffold a complete Docker action",
      ACTION_SNIPPET_DOCKER_FULL,
      position,
      "3_docker"
    )
  ];
}

/**
 * Creates a snippet completion item.
 */
function createSnippetCompletion(
  label: string,
  description: string,
  snippetText: string,
  position: Position,
  sortText: string
): CompletionItem {
  return {
    label,
    kind: CompletionItemKind.Snippet,
    documentation: {
      kind: "markdown",
      value: description
    },
    insertTextFormat: InsertTextFormat.Snippet,
    sortText,
    textEdit: TextEdit.insert(position, snippetText)
  };
}
