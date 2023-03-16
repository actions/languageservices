import {Octokit} from "@octokit/rest";
import fetchMock from "fetch-mock";
import {createWorkflowContext} from "../test-utils/workflow-context";
import {TTLCache} from "../utils/cache";
import {getActionDescription} from "./action-description";
import {actionsCheckoutMetadata} from "../test-utils/action-metadata";

const workflow = `
name: Hello World
on: workflow_dispatch
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
`;

async function getDescription(mock: fetchMock.FetchMockSandbox) {
  const workflowContext = await createWorkflowContext(workflow, "build", 0);

  return await getActionDescription(
    new Octokit({
      request: {
        fetch: mock
      }
    }),
    new TTLCache(),
    workflowContext.step! // eslint-disable-line @typescript-eslint/no-non-null-assertion
  );
}

describe("action descriptions", () => {
  it("actions/checkout description", async () => {
    const mock = fetchMock
      .sandbox()
      .getOnce("https://api.github.com/repos/actions/checkout/contents/action.yml?ref=v3", actionsCheckoutMetadata);

    expect(await getDescription(mock)).toEqual(
      "[**Checkout**](https://www.github.com/actions/checkout/tree/v3/)\n\nCheckout a Git repository at a particular version"
    );
  });

  it("action does not exist", async () => {
    const mock = fetchMock
      .sandbox()
      .getOnce("https://api.github.com/repos/actions/checkout/contents/action.yml?ref=v3", 404)
      .getOnce("https://api.github.com/repos/actions/checkout/contents/action.yaml?ref=v3", 404);

    expect(await getDescription(mock)).toBeUndefined();
  });

  it("invalid metadata", async () => {
    const mock = fetchMock
      .sandbox()
      .getOnce("https://api.github.com/repos/actions/checkout/contents/action.yml?ref=v3", {});

    expect(await getDescription(mock)).toBeUndefined();
  });
});
