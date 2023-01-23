## Contributing

[fork]: https://github.com/github/actions-languageservices/fork
[pr]: https://github.com/github/actions-languageservices/compare
[code-of-conduct]: CODE_OF_CONDUCT.md

Hi there! We're thrilled that you'd like to contribute to this project. Your help is essential for keeping it great.

Contributions to this project are [released](https://help.github.com/articles/github-terms-of-service/#6-contributions-under-repository-license) to the public under the [project's open source license](LICENSE.md).

Please note that this project is released with a [Contributor Code of Conduct][code-of-conduct]. By participating in this project you agree to abide by its terms.

## Prerequisites for running and testing code

These are one time installations required to be able to test your changes locally as part of the pull request (PR) submission process.

1. Install [Node.js](https://nodejs.org/en/download/) for your platform
1. Install the dependencies. From the repository root run:
```bash
$ npm i
```

This repository contains multiple packages and uses [npm workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces) to manage the dependencies between them.

## Submitting a pull request

1. [Fork][fork] and clone the repository
1. Configure and install the dependencies: `npm i`
1. Create a new branch: `git checkout -b my-branch-name`
1. Make your change, add tests, and make sure the tests and linter still pass
1. Push to your fork and [submit a pull request][pr]

Here are a few things you can do that will increase the likelihood of your pull request being accepted:

- Format your code with [prettier](https://prettier.io/).
- Write tests.
- Keep your change as focused as possible. If there are multiple changes you would like to make that are not dependent upon each other, consider submitting them as separate pull requests.
- Write a [good commit message](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html).

Please also look at the `README.md` files for each package for additional notes on contributing.

## Resources

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [Using Pull Requests](https://help.github.com/articles/about-pull-requests/)
- [GitHub Help](https://help.github.com)