# browser-playground

This is a web-based playground hosting the [language server](../actions-languageserver/) in a web worker connected to an instance of the [Monaco](https://microsoft.github.io/monaco-editor/) editor. You can try it at https://actions.github.com/languageservices.

## Contributing

### Build and run

Even though the package is part of the `npm` workspace, it needs its dependencies to be installed locally in order to run `webpack-dev-server`. To do so, run:

```bash
$ npm i --workspaces=no
```

then

```bash
$ npm start
```

to build and serve the app at `localhost:8080`.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) at the root of the repository for general guidelines and recommendations.

If you do want to contribute, please run [prettier](https://prettier.io/) to format your code before submitting your PR.

## License

This project is licensed under the terms of the MIT open source license. Please refer to [MIT](../LICENSE) for the full terms.