import {data, DescriptionDictionary} from "@actions/expressions";
import {getStepsContext as getDefaultStepsContext} from "@actions/languageservice/context-providers/steps";
import {Octokit} from "@octokit/rest";
import fetchMock from "fetch-mock";

import {createWorkflowContext} from "../test-utils/workflow-context";
import {TTLCache} from "../utils/cache";
import {getStepsContext} from "./steps";

const workflow = `
name: Caching Primes

on: push

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Cache Primes
      id: cache-primes
      uses: actions/cache@v3
      with:
        path: prime-numbers
        key: \${{ runner.os }}-primes

    - name: Generate Prime Numbers
      if: steps.cache-primes.outputs.cache-hit != 'true'
      run: /generate-primes.sh -d prime-numbers

    - name: Use Prime Numbers
      run: /primes.sh -d prime-numbers
`;

// https://api.github.com/repos/actions/cache/contents/action.yml?ref=v3
const actionMetadata = {
  name: "action.yml",
  path: "action.yml",
  sha: "3e158e3ee33f7e597ccf45c369a6e830dc8d43e3",
  size: 946,
  url: "https://api.github.com/repos/actions/cache/contents/action.yml?ref=v3",
  html_url: "https://github.com/actions/cache/blob/v3/action.yml",
  git_url: "https://api.github.com/repos/actions/cache/git/blobs/3e158e3ee33f7e597ccf45c369a6e830dc8d43e3",
  download_url: "https://raw.githubusercontent.com/actions/cache/v3/action.yml",
  type: "file",
  content:
    "bmFtZTogJ0NhY2hlJwpkZXNjcmlwdGlvbjogJ0NhY2hlIGFydGlmYWN0cyBs\naWtlIGRlcGVuZGVuY2llcyBhbmQgYnVpbGQgb3V0cHV0cyB0byBpbXByb3Zl\nIHdvcmtmbG93IGV4ZWN1dGlvbiB0aW1lJwphdXRob3I6ICdHaXRIdWInCmlu\ncHV0czoKICBwYXRoOgogICAgZGVzY3JpcHRpb246ICdBIGxpc3Qgb2YgZmls\nZXMsIGRpcmVjdG9yaWVzLCBhbmQgd2lsZGNhcmQgcGF0dGVybnMgdG8gY2Fj\naGUgYW5kIHJlc3RvcmUnCiAgICByZXF1aXJlZDogdHJ1ZQogIGtleToKICAg\nIGRlc2NyaXB0aW9uOiAnQW4gZXhwbGljaXQga2V5IGZvciByZXN0b3Jpbmcg\nYW5kIHNhdmluZyB0aGUgY2FjaGUnCiAgICByZXF1aXJlZDogdHJ1ZQogIHJl\nc3RvcmUta2V5czoKICAgIGRlc2NyaXB0aW9uOiAnQW4gb3JkZXJlZCBsaXN0\nIG9mIGtleXMgdG8gdXNlIGZvciByZXN0b3Jpbmcgc3RhbGUgY2FjaGUgaWYg\nbm8gY2FjaGUgaGl0IG9jY3VycmVkIGZvciBrZXkuIE5vdGUgYGNhY2hlLWhp\ndGAgcmV0dXJucyBmYWxzZSBpbiB0aGlzIGNhc2UuJwogICAgcmVxdWlyZWQ6\nIGZhbHNlCiAgdXBsb2FkLWNodW5rLXNpemU6CiAgICBkZXNjcmlwdGlvbjog\nJ1RoZSBjaHVuayBzaXplIHVzZWQgdG8gc3BsaXQgdXAgbGFyZ2UgZmlsZXMg\nZHVyaW5nIHVwbG9hZCwgaW4gYnl0ZXMnCiAgICByZXF1aXJlZDogZmFsc2UK\nb3V0cHV0czoKICBjYWNoZS1oaXQ6CiAgICBkZXNjcmlwdGlvbjogJ0EgYm9v\nbGVhbiB2YWx1ZSB0byBpbmRpY2F0ZSBhbiBleGFjdCBtYXRjaCB3YXMgZm91\nbmQgZm9yIHRoZSBwcmltYXJ5IGtleScKcnVuczoKICB1c2luZzogJ25vZGUx\nNicKICBtYWluOiAnZGlzdC9yZXN0b3JlL2luZGV4LmpzJwogIHBvc3Q6ICdk\naXN0L3NhdmUvaW5kZXguanMnCiAgcG9zdC1pZjogJ3N1Y2Nlc3MoKScKYnJh\nbmRpbmc6CiAgaWNvbjogJ2FyY2hpdmUnCiAgY29sb3I6ICdncmF5LWRhcmsn\nCg==\n",
  encoding: "base64",
  _links: {
    self: "https://api.github.com/repos/actions/cache/contents/action.yml?ref=v3",
    git: "https://api.github.com/repos/actions/cache/git/blobs/3e158e3ee33f7e597ccf45c369a6e830dc8d43e3",
    html: "https://github.com/actions/cache/blob/v3/action.yml"
  }
};

it("returns default context when job is undefined", async () => {
  const workflowContext = await createWorkflowContext(workflow, undefined);
  const defaultContext = getDefaultStepsContext(workflowContext);

  const stepsContext = await getStepsContext(new Octokit(), new TTLCache(), defaultContext, workflowContext);
  expect(stepsContext).toEqual(defaultContext);
});

it("adds action outputs", async () => {
  const mock = fetchMock
    .sandbox()
    .getOnce("https://api.github.com/repos/actions/cache/contents/action.yml?ref=v3", actionMetadata);

  const workflowContext = await createWorkflowContext(workflow, "build");
  const defaultContext = getDefaultStepsContext(workflowContext);

  const stepsContext = await getStepsContext(
    new Octokit({
      request: {
        fetch: mock
      }
    }),
    new TTLCache(),
    defaultContext,
    workflowContext
  );
  expect(stepsContext).toBeDefined();

  expect(stepsContext).toEqual(
    new DescriptionDictionary({
      key: "cache-primes",
      value: new DescriptionDictionary(
        {
          key: "outputs",
          value: new DescriptionDictionary({
            key: "cache-hit",
            value: new data.StringData("A boolean value to indicate an exact match was found for the primary key"),
            description: "A boolean value to indicate an exact match was found for the primary key"
          })
        },
        {
          key: "conclusion",
          value: new data.Null(),
          description:
            "The result of a completed step after `continue-on-error` is applied. Possible values are `success`, `failure`, `cancelled`, or `skipped`. When a `continue-on-error` step fails, the `outcome` is `failure`, but the final conclusion is `success`."
        },
        {
          key: "outcome",
          value: new data.Null(),
          description:
            "The result of a completed step before `continue-on-error` is applied. Possible values are `success`, `failure`, `cancelled`, or `skipped`. When a `continue-on-error` step fails, the `outcome` is `failure`, but the final conclusion is `success`."
        }
      )
    })
  );
});
