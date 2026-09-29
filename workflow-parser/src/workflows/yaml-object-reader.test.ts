import {TemplateContext, TemplateValidationErrors} from "../templates/template-context.js";
import {TemplateToken} from "../templates/tokens/index.js";
import {TokenType} from "../templates/tokens/types.js";
import {nullTrace} from "../test-utils/null-trace.js";
import {parseWorkflow} from "./workflow-parser.js";
import {getWorkflowSchema} from "./workflow-schema.js";
import {YamlObjectReader} from "./yaml-object-reader.js";

describe("getLiteralToken", () => {
  it("non-zero number", () => {
    const result = parseAsWorkflow("1");

    expect(result).not.toBeUndefined();
    expect(result?.templateTokenType).toEqual(TokenType.Number);
    expect(result?.toString()).toEqual("1");
  });

  it("zero", () => {
    const result = parseAsWorkflow("0");

    expect(result).not.toBeUndefined();
    expect(result?.templateTokenType).toEqual(TokenType.Number);
    expect(result?.toString()).toEqual("0");
  });

  it("true", () => {
    const result = parseAsWorkflow("true");

    expect(result).not.toBeUndefined();
    expect(result?.templateTokenType).toEqual(TokenType.Boolean);
    expect(result?.toString()).toEqual("true");
  });

  it("false", () => {
    const result = parseAsWorkflow("false");

    expect(result).not.toBeUndefined();
    expect(result?.templateTokenType).toEqual(TokenType.Boolean);
    expect(result?.toString()).toEqual("false");
  });

  it("string", () => {
    const result = parseAsWorkflow("test");

    expect(result).not.toBeUndefined();
    expect(result?.templateTokenType).toEqual(TokenType.String);
    expect(result?.toString()).toEqual("test");
  });

  it("null", () => {
    const result = parseAsWorkflow("null");

    expect(result).not.toBeUndefined();
    expect(result?.templateTokenType).toEqual(TokenType.Null);
    expect(result?.toString()).toEqual("");
  });
});

it("YAML errors include range information", () => {
  const content = `
  on: push
  jobs:
    build:
      runs-on: ubuntu-latest
      steps:
        - name: 'Hello \${{ fromJSON('test') == inputs.name }}'
          run: echo Hello, world!`;

  const context = new TemplateContext(new TemplateValidationErrors(), getWorkflowSchema(), nullTrace);
  const fileId = context.getFileId("test.yaml");
  const reader = new YamlObjectReader(fileId, content);

  expect(reader.errors.length).toBe(1);

  const error = reader.errors[0];
  expect(error.range).toEqual({
    start: {line: 7, column: 38},
    end: {line: 7, column: 63}
  });
});

function parseAsWorkflow(content: string): TemplateToken | undefined {
  const result = parseWorkflow(
    {
      name: "test.yaml",
      content: content
    },
    nullTrace
  );

  return result.value;
}
