import {StringToken} from "@github/actions-workflow-parser/templates/tokens/string-token";
import {Octokit} from "@octokit/rest";
import fetchMock from "fetch-mock";

import {createWorkflowContext} from "../test-utils/workflow-context";
import {TTLCache} from "../utils/cache";
import {getActionInputDescription} from "./action-input";

const workflow = `
name: Hello World
on: workflow_dispatch
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
`;

// A simplified version of the action.yml file from actions/checkout
const actionMetadataContent = `
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
const actionMetadata = {
  name: "action.yml",
  path: "action.yml",
  sha: "cab09ebd3a964aba67b57f9727f5f6fff1372b04",
  size: 3649,
  url: "https://api.github.com/repos/actions/checkout/contents/action.yml?ref=v3",
  html_url: "https://github.com/actions/checkout/blob/v3/action.yml",
  git_url: "https://api.github.com/repos/actions/checkout/git/blobs/cab09ebd3a964aba67b57f9727f5f6fff1372b04",
  download_url: "https://raw.githubusercontent.com/actions/checkout/v3/action.yml",
  type: "file",
  content: Buffer.from(actionMetadataContent).toString("base64"),
  encoding: "base64",
  _links: {
    self: "https://api.github.com/repos/actions/checkout/contents/action.yml?ref=v3",
    git: "https://api.github.com/repos/actions/checkout/git/blobs/cab09ebd3a964aba67b57f9727f5f6fff1372b04",
    html: "https://github.com/actions/checkout/blob/v3/action.yml"
  }
};

async function getDescription(input: string, mock: fetchMock.FetchMockSandbox) {
  const workflowContext = createWorkflowContext(workflow, "build", 0);

  return await getActionInputDescription(
    new Octokit({
      request: {
        fetch: mock
      }
    }),
    new TTLCache(),
    workflowContext.step!,
    new StringToken(undefined, undefined, input, undefined)
  );
}

describe("action descriptions", () => {
  it("optional input", async () => {
    const mock = fetchMock
      .sandbox()
      .getOnce("https://api.github.com/repos/actions/checkout/contents/action.yml?ref=v3", actionMetadata);

    expect(await getDescription("repository", mock)).toEqual(
      "Repository name with owner. For example, actions/checkout"
    );
  });

  it("required input", async () => {
    const mock = fetchMock
      .sandbox()
      .getOnce("https://api.github.com/repos/actions/checkout/contents/action.yml?ref=v3", actionMetadata);

    expect(await getDescription("ref", mock)).toEqual("The branch, tag or SHA to checkout.\n\n**Required**");
  });

  it("deprecated input", async () => {
    const mock = fetchMock
      .sandbox()
      .getOnce("https://api.github.com/repos/actions/checkout/contents/action.yml?ref=v3", actionMetadata);

    expect(await getDescription("repo", mock)).toEqual(
      "Repository name with owner. For example, actions/checkout\n\n**Deprecated**"
    );
  });

  it("invalid input", async () => {
    const mock = fetchMock
      .sandbox()
      .getOnce("https://api.github.com/repos/actions/checkout/contents/action.yml?ref=v3", actionMetadata);

    expect(await getDescription("typo", mock)).toBeUndefined();
  });
});
