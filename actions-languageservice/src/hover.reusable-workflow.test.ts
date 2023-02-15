import {isString} from "@github/actions-workflow-parser";
import {StringToken} from "@github/actions-workflow-parser/templates/tokens/string-token";
import {CompletionItem, MarkupContent} from "vscode-languageserver-types";
import {DescriptionProvider, hover, HoverConfig} from "./hover";
import {getPositionFromCursor} from "./test-utils/cursor-position";
import {testFileProvider} from "./test-utils/test-file-provider";

export function testHoverReusableWorkflowConfig(tokenValue: string, tokenKey: string) {
  return {
    descriptionProvider: {
      getDescription: async (_, token, __) => {
        if (!isString(token)) {
          throw new Error("Test provider only supports string tokens");
        }

        expect((token as StringToken).value).toEqual(tokenValue);
        expect(token.definition!.key).toEqual(tokenKey);

        return token.description;
      }
    } satisfies DescriptionProvider,
    fileProvider: testFileProvider
  } satisfies HoverConfig;
}

describe("completion with reusable workflows", () => {
  it("hover on job input with description", async () => {
    const input = `
on: push

jobs:
  build:
    uses: ./reusable-workflow-with-inputs.yaml
    with:
      us|ername:
`;
    const result = await hover(
      ...getPositionFromCursor(input),
      testHoverReusableWorkflowConfig("username", "scalar-needs-context")
    );
    expect(result).not.toBeUndefined();
    expect(result?.contents).toEqual(
      "A username passed from the caller workflow\n\n" +
      "**Context:** github, inputs, vars, needs, strategy, matrix"
    );
  });

  it("hover on job input without description", async () => {
    const input = `
on: push

jobs:
  build:
    uses: ./reusable-workflow-with-inputs-no-description.yaml
    with:
      us|ername:
`;
    const result = await hover(...getPositionFromCursor(input));
    expect(result).not.toBeUndefined();
    expect(result?.contents).toEqual("**Context:** github, inputs, vars, needs, strategy, matrix");
  });
});
