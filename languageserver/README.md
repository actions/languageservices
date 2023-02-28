# actions/languageserver

`actions-languageserver` hosts the `actions-languageservice` and makes it available via the [language server protocol](https://microsoft.github.io/language-server-protocol/) (LSP) as a standalone language server.

## Installation

The [package](https://www.npmjs.com/package/@actions/languageserver) contains TypeScript types and compiled ECMAScript modules.

```bash
npm install @actions/languageserver
```

## Usage

### Basic usage using `vscode-languageserver-node`

For the server, import the module. It detects whether it's running in a Node.js environment or a web worker and initializes the appropriate connection.

`server.ts`:

```typescript
import "@actions/languageserver";
```

For the client, create a new `LanguageClient` pointing to the server module.

`client.ts`:

```typescript
import {LanguageClient, ServerOptions, TransportKind} from "vscode-languageclient/node";

const debugOptions = {execArgv: ["--nolazy", "--inspect=6010"]};

const clientOptions: LanguageClientOptions = {
  documentSelector: [{
    pattern: "**/.github/workflows/*.{yaml,yml}"
  }]
};

const serverModule = context.asAbsolutePath(path.join("dist", "server.js"));
const serverOptions: ServerOptions = {
  run: {module: serverModule, transport: TransportKind.ipc},
  debug: {
    module: serverModule,
    transport: TransportKind.ipc,
    options: debugOptions
  }
};

const client = new LanguageClient("actions-language", "GitHub Actions Language Server", serverOptions, clientOptions);
```

### From a web worker

See [../browser-playground](../browser-playground) for an example implementation that hosts the language server in a web worker.

### Providing advanced functionality

The language server accepts initialization options that can be used to configure additional functionality. If you pass in a github.com `sessionToken`, the language service will use data from github.com to perform additional validations and provide additional auto-completion suggestions.

```typescript
export interface InitializationOptions {
  /**
   * GitHub token that will be used to retrieve additional information from github.com
   *
   * Requires the `repo` and `workflow` scopes
   */
  sessionToken?: string;

  /**
   * List of repositories that the language server should be aware of
   */
  repos?: RepositoryContext[];

  /**
   * Desired log level
   */
  logLevel?: LogLevel;
}
```

pass the `initializationOptions` to the `LanguageClient` when establishing the connection:

```typescript
const clientOptions: LanguageClientOptions = {
  documentSelector: [{
    pattern: "**/.github/workflows/*.{yaml,yml}"
  }],
  initializationOptions: initializationOptions
};

const client = new LanguageClient("actions-language", "GitHub Actions Language Server", serverOptions, clientOptions);
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

