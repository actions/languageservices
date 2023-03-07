# actions/languageservice

This package contains the logic for the GitHub Actions workflows language server.

## Installation

The [package](https://www.npmjs.com/package/@actions/languageservice) contains TypeScript types and compiled ECMAScript modules.

```bash
npm install @actions/languageservice
```

## Usage

### Basic usage

#### Concepts

The language service features use three sources of information:

* a built-in static schema for the workflow YAML file
* _value providers_ which can dynamically add values to the schema, for example, the list of available labels for a repository when validating `runs-on`.
* _context providers_ which can dynamically provide available contexts used in [expressions](https://docs.github.com/actions/reference/context-and-expression-syntax-for-github-actions#about-contexts-and-expressions). For example, the contents of the `github.event` context for a given workflow file.

#### Validation

Validate a workflow file, returns an array of [`Diagnostic`](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#diagnostic) objects.

```typescript
const config: ValidationConfig = {
  valueProviderConfig: valueProviders(sessionToken, repoContext, cache),
  contextProviderConfig: contextProviders(sessionToken, repoContext, cache),
};

const result = await validate(textDocument, config); // result is an array of `Diagnostic`
```

#### Hover

Get information when [hovering](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_hover) over a token in the workflow file.

```typescript
import {hover} from "@actions/languageservice";

const document = {
  uri: "file:///path/to/file",
  getText: () => "on: push\n  jobs:\n    build:\n      runs-on: ubuntu-latest\n      steps:\n        - run: echo hello"
};

const hover = await hover(document, {line: 0, character: 1}); // { contents: { kind: "markdown", value: "The event that triggers the workflow" } }
```

#### Auto-completion

```typescript
import {complete} from "@actions/languageservice";

const document = {
  uri: "file:///path/to/file",
  getText: () => `on: 
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: echo hello`
};

// Trigger completion for `on: |`
const suggestions = await complete(document, {line: 0, character: 4});
```

will return

```jsonc
[{
  "documentation": {
    "kind": "markdown",
    "value": "Runs your workflow when branch protection rules in the workflow repository are changed.",
  },
  "label": "branch_protection_rule",
  "textEdit": {
    "newText": "branch_protection_rule",
    "range": {
      "end": {"character": 4, "line": 0,},
      "start": {"character": 4, "line": 0},
    },
  },
},
//... other events
]
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) at the root of the repository for general guidelines and recommendations.

If you do want to contribute, please run [prettier](https://prettier.io/) to format your code and add unit tests as appropriate before submitting your PR.

### Build

```bash
npm run build
```

or to watch for changes

```bash
npm run watch
```

### Test

```bash
npm test
```

or to watch for changes and run tests:

```bash
npm run test-watch
```

### Lint

```bash
npm run format-check
```

## License

This project is licensed under the terms of the MIT open source license. Please refer to [MIT](../LICENSE) for the full terms.