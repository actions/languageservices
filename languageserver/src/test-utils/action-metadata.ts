// A simplified version of the action.yml file from actions/checkout
const checkoutMetadataContent = `
name: 'Checkout'
description: 'Checkout a Git repository at a particular version'
inputs:
  repository:
    description: Repository name with owner. For example, actions/checkout
    default: \${{ github.repository }}
  ref:
    description: The branch, tag or SHA to checkout.
    required: true
  token:
    description: Personal access token (PAT) used to fetch the repository.
    default: \${{ github.token }}
  repo:
    description: 'Repository name with owner. For example, actions/checkout'
    deprecationMessage: 'Use repository instead'
runs:
  using: node16
  main: dist/index.js
  post: dist/index.js
`;

// Based on https://api.github.com/repos/actions/checkout/contents/action.yml?ref=v3
export const actionsCheckoutMetadata = {
  name: "action.yml",
  path: "action.yml",
  sha: "cab09ebd3a964aba67b57f9727f5f6fff1372b04",
  size: 3649,
  url: "https://api.github.com/repos/actions/checkout/contents/action.yml?ref=v3",
  html_url: "https://github.com/actions/checkout/blob/v3/action.yml",
  git_url: "https://api.github.com/repos/actions/checkout/git/blobs/cab09ebd3a964aba67b57f9727f5f6fff1372b04",
  download_url: "https://raw.githubusercontent.com/actions/checkout/v3/action.yml",
  type: "file",
  content: Buffer.from(checkoutMetadataContent).toString("base64"),
  encoding: "base64",
  _links: {
    self: "https://api.github.com/repos/actions/checkout/contents/action.yml?ref=v3",
    git: "https://api.github.com/repos/actions/checkout/git/blobs/cab09ebd3a964aba67b57f9727f5f6fff1372b04",
    html: "https://github.com/actions/checkout/blob/v3/action.yml"
  }
};
