# actions-expressions

`actions-expressions` is a library to parse and evaluate GitHub Actions [expressions](https://docs.github.com/actions/learn-github-actions/expressions).

## Installation

The [package](https://www.npmjs.com/package/@actions/expressions) contains TypeScript types and compiled ECMAScript modules.

```bash
npm install @actions/expressions
```

## Usage

### Simple example

```ts
import { Parser, Lexer, Evaluator, data } from '@actions/expressions';

const lexer = new Lexer("1 == 2");
const lr = lexer.lex();

const parser = new Parser(lr.tokens, [], []);
const expr = parser.parse();

const evaluator = new Evaluator(expr, new data.Dictionary());
const result = evaluator.evaluate();

console.log(result.coerceString()) // false
```

### With context data

```ts
import { Parser, Lexer, Evaluator, data } from '@actions/expressions';

const lexer = new Lexer("'monalisa' == context.name");
const lr = lexer.lex();

const parser = new Parser(lr.tokens, ["context"], []);
const expr = parser.parse();

const evaluator = new Evaluator(expr, new data.Dictionary([{
  key: "context"
  value: new data.Dictionary([{
    key: "name"
    value: new data.StringData("monalisa")
  }])
}]));
const result = evaluator.evaluate();

console.log(result.coerceString()) // true
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) at the root of the repository for general guidelines and recommendations.

This project is just one of multiple implementations of the GitHub Actions Expressions language. We therefore cannot accept contributions that add new language features or significantly change the behavior of existing language features. If you would like to propose a change to the language itself, please use our [Community Forum](https://github.com/community/community/discussions/categories/actions-and-packages).

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