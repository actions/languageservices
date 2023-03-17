import {DescriptionDictionary, isDescriptionDictionary} from "@github/actions-expressions/.";
import {testGetWorkflowContext} from "../test-utils/test-workflow-context";
import {Mode} from "./default";
import {getGithubContext} from "./github";

describe("github context", () => {
  it("single event", async () => {
    const workflowContext = await testGetWorkflowContext(`on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: ec|ho`);

    const g = getGithubContext(workflowContext, Mode.Completion);
    if (!isDescriptionDictionary(g)) {
      fail();
    }

    const e = g.get("event") as DescriptionDictionary;

    expect(e.pairs().map(p => p.key)).toEqual([
      "after",
      "base_ref",
      "before",
      "commits",
      "compare",
      "created",
      "deleted",
      "enterprise",
      "forced",
      "head_commit",
      "installation",
      "organization",
      "pusher",
      "ref",
      "repository",
      "sender"
    ]);
  });

  it("single event - multiple types", async () => {
    const workflowContext = await testGetWorkflowContext(`
on:
  pull_request:
    types:
    - 'synchronize'
    - 'ready_for_review'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: ec|ho`);

    const g = getGithubContext(workflowContext, Mode.Completion);
    if (!isDescriptionDictionary(g)) {
      fail();
    }

    const e = g.get("event") as DescriptionDictionary;

    expect(e.pairs().map(p => p.key)).toEqual([
      "action",
      "after",
      "before",
      "enterprise",
      "installation",
      "number",
      "organization",
      "pull_request",
      "repository",
      "sender"
    ]);
  });

  it("single event - no default types", async () => {
    const workflowContext = await testGetWorkflowContext(`
on:
  issues:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: ec|ho`);

    const g = getGithubContext(workflowContext, Mode.Completion);
    if (!isDescriptionDictionary(g)) {
      fail();
    }

    const e = g.get("event") as DescriptionDictionary;
    const i = e.get("issue") as DescriptionDictionary;

    expect(i.pairs().map(p => p.key)).toEqual([
      "active_lock_reason",
      "assignee",
      "assignees",
      "author_association",
      "body",
      "closed_at",
      "comments",
      "comments_url",
      "created_at",
      "draft",
      "events_url",
      "html_url",
      "id",
      "labels",
      "labels_url",
      "locked",
      "milestone",
      "node_id",
      "number",
      "performed_via_github_app",
      "pull_request",
      "reactions",
      "repository_url",
      "state",
      "state_reason",
      "timeline_url",
      "title",
      "updated_at",
      "url",
      "user"
    ]);
  });

  it("multiple events - multiple types", async () => {
    const workflowContext = await testGetWorkflowContext(`
on:
  push:
  pull_request:
    types:
    - 'synchronize'
    - 'ready_for_review'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: ec|ho`);

    const g = getGithubContext(workflowContext, Mode.Completion);
    if (!isDescriptionDictionary(g)) {
      fail();
    }

    const e = g.get("event") as DescriptionDictionary;

    expect(
      e
        .pairs()
        .map(p => p.key)
        .sort()
    ).toEqual([
      "action",
      "after",
      "base_ref",
      "before",
      "commits",
      "compare",
      "created",
      "deleted",
      "enterprise",
      "forced",
      "head_commit",
      "installation",
      "number",
      "organization",
      "pull_request",
      "pusher",
      "ref",
      "repository",
      "sender"
    ]);
  });
});
