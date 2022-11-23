import {isScalar, parseWorkflow} from "@github/actions-workflow-parser/.";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {TokenType} from "@github/actions-workflow-parser/templates/tokens/types";
import {nullTrace} from "../nulltrace";
import {getPositionFromCursor} from "../test-utils/cursor-position";
import {findToken} from "./find-token";

type testTokenInfo = [definitionKey: string | null, tokenType: TokenType, literalValue?: string];

function getTokenInfo(token: TemplateToken | null): testTokenInfo | null {
  if (!token) {
    return null;
  }

  return [
    token.definition?.key ?? null,
    token.templateTokenType,
    isScalar(token) ? token.toDisplayString() : undefined
  ].filter(x => x !== undefined) as testTokenInfo;
}

function testFindToken(input: string): {
  parent: testTokenInfo | null;
  key: testTokenInfo | null;
  token: testTokenInfo | null;
  path: testTokenInfo[];
} {
  const [textDocument, pos] = getPositionFromCursor(input);
  const result = parseWorkflow(
    "wf.yaml",
    [
      {
        content: textDocument.getText(),
        name: "wf.yaml"
      }
    ],
    nullTrace
  );

  const r = findToken(pos, result.value);

  return {
    parent: getTokenInfo(r.parent),
    key: getTokenInfo(r.keyToken),
    token: getTokenInfo(r.token),
    path: r.path.map(x => getTokenInfo(x)!)
  };
}

describe("find-token", () => {
  it("on string key", () => {
    expect(testFindToken(`o|n: push`)).toEqual({
      path: [["workflow-root-strict", TokenType.Mapping]],
      parent: ["workflow-root-strict", TokenType.Mapping],
      key: null,
      token: [null, TokenType.String, "on"]
    });
  });

  it("on string value", () => {
    expect(testFindToken(`on: pu|sh`)).toEqual({
      path: [
        ["workflow-root-strict", TokenType.Mapping],
        [null, TokenType.String, "on"]
      ],
      parent: ["workflow-root-strict", TokenType.Mapping],
      key: [null, TokenType.String, "on"],
      token: ["on-strict", TokenType.String, "push"]
    });
  });

  it("on mapping", () => {
    expect(
      testFindToken(`on:
  pu|sh:`)
    ).toEqual({
      path: [
        ["workflow-root-strict", TokenType.Mapping],
        [null, TokenType.String, "on"],
        ["on-mapping-strict", TokenType.Mapping]
      ],
      parent: ["on-mapping-strict", TokenType.Mapping],
      key: null,
      token: [null, TokenType.String, "push"]
    });
  });

  it("on sequence", () => {
    expect(
      testFindToken(`on:
    - pu|sh`)
    ).toEqual({
      path: [
        ["workflow-root-strict", TokenType.Mapping],
        [null, TokenType.String, "on"],
        ["on-strict", TokenType.Sequence]
      ],
      parent: ["on-strict", TokenType.Sequence],
      key: null,
      token: ["non-empty-string", TokenType.String, "push"]
    });
  });

  it("on sequence with cursor outside of sequence values", () => {
    expect(
      testFindToken(`on:
    -| push`)
    ).toEqual({
      path: [
        ["workflow-root-strict", TokenType.Mapping],
        [null, TokenType.String, "on"],
        ["on-strict", TokenType.Sequence]
      ],
      parent: ["on-strict", TokenType.Sequence],
      key: null,
      token: null
    });
  });

  it("on sequence with multiple values", () => {
    expect(
      testFindToken(`on:
    - push
    - pull_request|`)
    ).toEqual({
      path: [
        ["workflow-root-strict", TokenType.Mapping],
        [null, TokenType.String, "on"],
        ["on-strict", TokenType.Sequence]
      ],
      parent: ["on-strict", TokenType.Sequence],
      key: null,
      token: ["non-empty-string", TokenType.String, "pull_request"]
    });
  });

  it("single-line sequence with multiple values", () => {
    expect(
      testFindToken(`on: push
jobs:
  build:
    runs-on: [ubuntu-latest, self|`)
    ).toEqual({
      path: [
        ["workflow-root-strict", TokenType.Mapping],
        [null, TokenType.String, "jobs"],
        ["jobs", TokenType.Mapping],
        ["job-id", TokenType.String, "build"],
        ["job-factory", TokenType.Mapping],
        [null, TokenType.String, "runs-on"],
        ["runs-on", TokenType.Sequence]
      ],
      parent: ["runs-on", TokenType.Sequence],
      key: null,
      token: ["non-empty-string", TokenType.String, "self"]
    });
  });

  it("jobs key", () => {
    expect(
      testFindToken(`on: push
jo|bs:
  build:`)
    ).toEqual({
      path: [["workflow-root-strict", TokenType.Mapping]],
      parent: ["workflow-root-strict", TokenType.Mapping],
      key: null,
      token: [null, TokenType.String, "jobs"]
    });
  });

  it("value in job", () => {
    expect(
      testFindToken(`on: push
jobs:
  build:
    runs-on: ubu|`)
    ).toEqual({
      path: [
        ["workflow-root-strict", TokenType.Mapping],
        [null, TokenType.String, "jobs"],
        ["jobs", TokenType.Mapping],
        ["job-id", TokenType.String, "build"],
        ["job-factory", TokenType.Mapping],
        [null, TokenType.String, "runs-on"]
      ],
      parent: ["job-factory", TokenType.Mapping],
      key: [null, TokenType.String, "runs-on"],
      token: ["runs-on", TokenType.String, "ubu"]
    });
  });

  it("key in job", () => {
    expect(
      testFindToken(`on: push
jobs:
  build:
    run|s-on: ubu`)
    ).toEqual({
      path: [
        ["workflow-root-strict", TokenType.Mapping],
        [null, TokenType.String, "jobs"],
        ["jobs", TokenType.Mapping],
        ["job-id", TokenType.String, "build"],
        ["job-factory", TokenType.Mapping]
      ],
      parent: ["job-factory", TokenType.Mapping],
      key: null,
      token: [null, TokenType.String, "runs-on"]
    });
  });

  it("pos after colon in empty null mapping ", () => {
    expect(
      testFindToken(`on: push
jobs:
  build:
    continue-on-error:|`)
    ).toEqual({
      path: [
        ["workflow-root-strict", TokenType.Mapping],
        [null, TokenType.String, "jobs"],
        ["jobs", TokenType.Mapping],
        ["job-id", TokenType.String, "build"],
        ["job-factory", TokenType.Mapping]
      ],
      parent: ["job-factory", TokenType.Mapping],
      key: [null, TokenType.String, "continue-on-error"],
      token: ["boolean-strategy-context", TokenType.Null, ""]
    });
  });

  it("pos after colon in empty string mapping", () => {
    expect(
      testFindToken(`on: push
jobs:
  build:
    container:|`)
    ).toEqual({
      path: [
        ["workflow-root-strict", TokenType.Mapping],
        [null, TokenType.String, "jobs"],
        ["jobs", TokenType.Mapping],
        ["job-id", TokenType.String, "build"],
        ["job-factory", TokenType.Mapping]
      ],
      parent: ["job-factory", TokenType.Mapping],
      key: [null, TokenType.String, "container"],
      token: ["container", TokenType.String, ""]
    });
  });

  it("pos after colon in mapping", () => {
    expect(
      testFindToken(`on: push
jobs:
  build:
    continue-on-error:|foo`)
    ).toEqual({
      path: [
        ["workflow-root-strict", TokenType.Mapping],
        [null, TokenType.String, "jobs"],
        ["jobs", TokenType.Mapping],
        ["job-id", TokenType.String, "build"]
      ],
      parent: ["jobs", TokenType.Mapping],
      key: ["job-id", TokenType.String, "build"],
      token: ["job", TokenType.String, "continue-on-error:foo"]
    });
  });

  it("pos after mapping key", () => {
    expect(
      testFindToken(`on: push
jobs:
  build:
    continue-on-error:| foo`)
    ).toEqual({
      path: [
        ["workflow-root-strict", TokenType.Mapping],
        [null, TokenType.String, "jobs"],
        ["jobs", TokenType.Mapping],
        ["job-id", TokenType.String, "build"],
        ["job-factory", TokenType.Mapping]
      ],
      parent: ["job-factory", TokenType.Mapping],
      key: null,
      token: null
    });
  });

  it("pos at end of completed mapping key", () => {
    expect(
      testFindToken(`on: push
jobs:
  build:
    continue-on-error|: foo`)
    ).toEqual({
      path: [
        ["workflow-root-strict", TokenType.Mapping],
        [null, TokenType.String, "jobs"],
        ["jobs", TokenType.Mapping],
        ["job-id", TokenType.String, "build"],
        ["job-factory", TokenType.Mapping]
      ],
      parent: ["job-factory", TokenType.Mapping],
      key: null,
      token: [null, TokenType.String, "continue-on-error"]
    });
  });

  it("pos in mapping key without comment", () => {
    expect(
      testFindToken(`on: push
jobs:
  build:
    runs-|`)
    ).toEqual({
      path: [
        ["workflow-root-strict", TokenType.Mapping],
        [null, TokenType.String, "jobs"],
        ["jobs", TokenType.Mapping],
        ["job-id", TokenType.String, "build"]
      ],
      parent: ["jobs", TokenType.Mapping],
      key: ["job-id", TokenType.String, "build"],
      token: ["job", TokenType.String, "runs-"]
    });
  });

  it("pos in mapping key before comment", () => {
    expect(
      testFindToken(`on: push
jobs:
  build:
    runs-|
  #`)
    ).toEqual({
      path: [
        ["workflow-root-strict", TokenType.Mapping],
        [null, TokenType.String, "jobs"],
        ["jobs", TokenType.Mapping],
        ["job-id", TokenType.String, "build"]
      ],
      parent: ["jobs", TokenType.Mapping],
      key: ["job-id", TokenType.String, "build"],
      token: ["job", TokenType.String, "runs-"]
    });
  });

  it("empty node", () => {
    expect(
      testFindToken(`on: push
jobs:
  build:
    concurrency:
    runs-on: ubu|`)
    ).toEqual({
      path: [
        ["workflow-root-strict", TokenType.Mapping],
        [null, TokenType.String, "jobs"],
        ["jobs", TokenType.Mapping],
        ["job-id", TokenType.String, "build"],
        ["job-factory", TokenType.Mapping],
        [null, TokenType.String, "runs-on"]
      ],
      parent: ["job-factory", TokenType.Mapping],
      key: [null, TokenType.String, "runs-on"],
      token: ["runs-on", TokenType.String, "ubu"]
    });
  });
});
