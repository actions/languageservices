# actions/workflow-parser

`@actions/workflow-parser` is a library to parse GitHub Actions [workflows](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions).

## Installation

The [package](https://www.npmjs.com/package/@actions/workflow-parser) contains TypeScript types and compiled ECMAScript modules.

```bash
npm install @actions/workflow-parser
```

## Usage

The parser is driven by a custom schema defined in [`worflows-v1.0.json`](./src/workflow-v1.0.json).

### Simple example

`parseWorkflow` parses the workflow YAML into an intermediate representation and validates that it conforms to the schema. Any parsing errors are returned in the `errors` property of the result context.

```typescript
var trace: TraceWriter;

const result = parseWorkflow(
  {
    name: "test.yaml",
    content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: echo 'hello'`
  },
  trace
);
```

`convertWorkflowTemplate` then takes that intermediate representation and converts it to a [`WorkflowTemplate`](./src/model/workflow-template.ts) object, which is a more convenient representation for working with workflows.

```typescript
const workflowTemplate = await convertWorkflowTemplate(result.context, result.value);

// workflowTemplate.jobs[0].id === "build"
// workflowTemplate.jobs[0].steps[0].run === "echo 'hello'"
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) at the root of the repository for general guidelines and recommendations.

Similar to [`actions/expressions`](../expressions/), this project is just one of multiple implementations of the GitHub Actions workflow parser. We therefore cannot accept contributions that significantly modify the schema or the overall behavior of the parser. If you would like to propose changes to Actions itself, please use our [Community Forum](https://github.com/community/community/discussions/categories/actions-and-packages).

If you do want to contribute, please run [prettier](https://prettier.io/) to format your code and add unit tests as appropriate before submitting your PR. [./testdata](./testdata) contains test cases that all implementations should pass, please also make sure those tests are still passing.

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
