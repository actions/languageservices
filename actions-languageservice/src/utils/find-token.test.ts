import {isScalar, parseWorkflow} from "@github/actions-workflow-parser/.";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {TokenType} from "@github/actions-workflow-parser/templates/tokens/types";
import {nullTrace} from "../nulltrace";
import {getPositionFromCursor} from "../test-utils/cursor-position";
import {findToken} from "./find-token";

type testTokenInfo = [string | null, TokenType, string?];

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
    token: getTokenInfo(r.token)
  };
}

describe("find-token", () => {
  it("on string key", () => {
    expect(testFindToken(`o|n: push`)).toEqual({
      parent: ["workflow-root-strict", TokenType.Mapping],
      key: null,
      token: [null, TokenType.String, "on"]
    });
  });

  it("on string value", () => {
    expect(testFindToken(`on: pu|sh`)).toEqual({
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
      parent: ["on-strict", TokenType.Mapping],
      key: ["push-event-mapping", TokenType.String, "push"],
      token: ["on-strict", TokenType.Mapping]
    });
  });

  it("on sequence", () => {
    expect(
      testFindToken(`on:
    - pu|sh`)
    ).toEqual({
      parent: ["on-strict", TokenType.Sequence],
      key: null,
      token: ["non-empty-string", TokenType.String, "push"]
    });
  });

  it("jobs key", () => {
    expect(
      testFindToken(`on: push
jo|bs:
  build:`)
    ).toEqual({
      parent: ["workflow-root-strict", TokenType.Mapping],
      key: null,
      token: ["jobs", TokenType.Mapping]
    });
  });
});
