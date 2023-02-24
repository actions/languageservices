import {StringToken} from "@actions/workflow-parser/templates/tokens/string-token";
import {Octokit} from "@octokit/rest";
import fetchMock from "fetch-mock";

import {actionsCheckoutMetadata} from "../test-utils/action-metadata";
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

async function getDescription(input: string, mock: fetchMock.FetchMockSandbox) {
  const workflowContext = await createWorkflowContext(workflow, "build", 0);

  return await getActionInputDescription(
    new Octokit({
      request: {
        fetch: mock
      }
    }),
    new TTLCache(),
    workflowContext.step!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
    new StringToken(undefined, undefined, input, undefined)
  );
}

describe("action input descriptions", () => {
  it("optional input", async () => {
    const mock = fetchMock
      .sandbox()
      .getOnce("https://api.github.com/repos/actions/checkout/contents/action.yml?ref=v3", actionsCheckoutMetadata);

    expect(await getDescription("repository", mock)).toEqual(
      "Repository name with owner. For example, actions/checkout"
    );
  });

  it("required input", async () => {
    const mock = fetchMock
      .sandbox()
      .getOnce("https://api.github.com/repos/actions/checkout/contents/action.yml?ref=v3", actionsCheckoutMetadata);

    expect(await getDescription("ref", mock)).toEqual("The branch, tag or SHA to checkout.\n\n**Required**");
  });

  it("deprecated input", async () => {
    const mock = fetchMock
      .sandbox()
      .getOnce("https://api.github.com/repos/actions/checkout/contents/action.yml?ref=v3", actionsCheckoutMetadata);

    expect(await getDescription("repo", mock)).toEqual(
      "Repository name with owner. For example, actions/checkout\n\n**Deprecated**"
    );
  });

  it("invalid input", async () => {
    const mock = fetchMock
      .sandbox()
      .getOnce("https://api.github.com/repos/actions/checkout/contents/action.yml?ref=v3", actionsCheckoutMetadata);

    expect(await getDescription("typo", mock)).toBeUndefined();
  });

  it("action does not exist", async () => {
    const mock = fetchMock
      .sandbox()
      .getOnce("https://api.github.com/repos/actions/checkout/contents/action.yml?ref=v3", 404)
      .getOnce("https://api.github.com/repos/actions/checkout/contents/action.yaml?ref=v3", 404);

    expect(await getDescription("repository", mock)).toBeUndefined();
  });

  it("invalid permissions", async () => {
    const mock = fetchMock
      .sandbox()
      .getOnce("https://api.github.com/repos/actions/checkout/contents/action.yml?ref=v3", 403);

    expect(await getDescription("repository", mock)).toBeUndefined();
  });
});
