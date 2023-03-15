import {data, DescriptionDictionary, Lexer, Parser} from "@github/actions-expressions";
import {convertWorkflowTemplate, parseWorkflow} from "@github/actions-workflow-parser";
import {ErrorPolicy} from "@github/actions-workflow-parser/model/convert";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {ContextProviderConfig} from "../context-providers/config";
import {getContext, Mode} from "../context-providers/default";
import {getWorkflowContext} from "../context/workflow-context";
import {validatorFunctions} from "../expression-validation/functions";
import {nullTrace} from "../nulltrace";
import {getPositionFromCursor} from "../test-utils/cursor-position";
import {HoverVisitor} from "./visitor";

const contextProviderConfig: ContextProviderConfig = {
  getContext: (context: string) => {
    switch (context) {
      case "github":
        return Promise.resolve(
          new DescriptionDictionary(
            {
              key: "event",
              value: new data.StringData("push"),
              description: "The event that triggered the workflow"
            },
            {
              key: "test",
              value: new DescriptionDictionary({
                key: "name",
                value: new data.StringData("push"),
                description: "Name for the test"
              }),
              description: "Test dictionary"
            }
          )
        );
    }

    return Promise.resolve(undefined);
  }
};

describe("visitor", () => {
  describe("unsupported hover positions", () => {
    ["1 =|= 2", "12|3", "1 == |(2)", "'ab|c'"].forEach(x =>
      it(x, async () => expect(await hoverExpression(x)).toBeUndefined())
    );
  });

  it("top-level context access", async () => {
    expect(await hoverExpression("githu|b")).toEqual({
      label: "github",
      description:
        "Information about the workflow run. For more information, see [`github` context](https://docs.github.com/actions/learn-github-actions/contexts#github-context).",
      function: false,
      range: {
        start: {line: 0, column: 0},
        end: {line: 0, column: 6}
      }
    });
  });

  it("nested context access", async () => {
    expect(await hoverExpression("github.test.na|me")).toEqual({
      label: "name",
      description: "Name for the test",
      function: false,
      range: {
        start: {line: 0, column: 0},
        end: {line: 0, column: 16}
      }
    });
  });

  it("nested context access with string key", async () => {
    expect(await hoverExpression("github['te|st']")).toEqual({
      label: "test",
      description: "Test dictionary",
      function: false,
      range: {
        start: {line: 0, column: 0},
        end: {line: 0, column: 13}
      }
    });
  });

  it("function call", async () => {
    expect(await hoverExpression("cont|ains(github, 'github')")).toEqual({
      label: "contains",
      description:
        "`contains( search, item )`\n\nReturns `true` if `search` contains `item`. If `search`" +
        " is an array, this function returns `true` if the `item` is an element in the array. If `search`" +
        " is a string, this function returns `true` if the `item` is a substring of `search`. This function" +
        " is not case sensitive. Casts values to a string.",
      function: true,
      range: {
        start: {line: 0, column: 0},
        end: {line: 0, column: 8}
      }
    });
  });
});

async function hoverExpression(input: string) {
  const [td, pos] = getPositionFromCursor(input);
  const allowedContext = ["github"];

  const file: File = {
    name: td.uri,
    content: td.getText()
  };
  const result = parseWorkflow(file, nullTrace);
  if (!result.value) {
    return undefined;
  }

  const template = await convertWorkflowTemplate(result.context, result.value, undefined, {
    errorPolicy: ErrorPolicy.TryConversion
  });
  const workflowContext = getWorkflowContext(td.uri, template, []);
  const context = await getContext(allowedContext, contextProviderConfig, workflowContext, Mode.Completion);

  const l = new Lexer(td.getText());
  const lr = l.lex();

  const p = new Parser(lr.tokens, ["github"], []);
  const expr = p.parse();

  const hv = new HoverVisitor(
    {
      line: pos.line,
      column: pos.character
    },
    context,
    [],
    validatorFunctions
  );
  return hv.hover(expr);
}
