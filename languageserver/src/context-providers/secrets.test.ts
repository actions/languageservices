import {data, DescriptionDictionary} from "@actions/expressions";
import {Mode} from "@actions/languageservice/context-providers/default";
import {Octokit} from "@octokit/rest";
import fetchMock from "fetch-mock";

import {RepositoryContext} from "../initializationOptions.js";
import {createWorkflowContext} from "../test-utils/workflow-context.js";
import {TTLCache} from "../utils/cache.js";
import {getSecrets} from "./secrets.js";

const workflowCallOnly = `
name: probe

on:
  workflow_call:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo
`;

const repo: RepositoryContext = {
  id: 1,
  owner: "test-owner",
  name: "test-repo",
  organizationOwned: true,
  workspaceUri: "file:///workspace"
};

function mockOctokit() {
  const mock = fetchMock
    .sandbox()
    .getOnce("https://api.github.com/user", {login: "tester"})
    .getOnce("https://api.github.com/repos/test-owner/test-repo/collaborators/tester/permission", {
      permission: "write"
    })
    .get("begin:https://api.github.com/repos/test-owner/test-repo/actions/secrets", {
      total_count: 1,
      secrets: [{name: "REPO_SECRET"}]
    })
    .get("begin:https://api.github.com/repos/test-owner/test-repo/actions/organization-secrets", {
      total_count: 1,
      secrets: [{name: "ORG_SECRET"}]
    });

  return new Octokit({
    request: {
      fetch: mock
    }
  });
}

it("loads remote secrets for completion when workflow_call is the only trigger", async () => {
  const workflowContext = await createWorkflowContext(workflowCallOnly, "build");
  const defaultContext = new DescriptionDictionary();
  defaultContext.add("GITHUB_TOKEN", new data.StringData("***"));

  const secrets = await getSecrets(
    workflowContext,
    mockOctokit(),
    new TTLCache(),
    repo,
    defaultContext,
    Mode.Completion
  );

  expect(secrets.get("REPO_SECRET")).toBeDefined();
  expect(secrets.get("ORG_SECRET")).toBeDefined();
  expect(secrets.complete).toBe(false);
});

it("skips remote secrets during validation when workflow_call is the only trigger", async () => {
  const workflowContext = await createWorkflowContext(workflowCallOnly, "build");
  const defaultContext = new DescriptionDictionary();
  defaultContext.add("GITHUB_TOKEN", new data.StringData("***"));

  const secrets = await getSecrets(
    workflowContext,
    mockOctokit(),
    new TTLCache(),
    repo,
    defaultContext,
    Mode.Validation
  );

  expect(secrets.get("REPO_SECRET")).toBeUndefined();
  expect(secrets.get("ORG_SECRET")).toBeUndefined();
  expect(secrets.complete).toBe(false);
});
