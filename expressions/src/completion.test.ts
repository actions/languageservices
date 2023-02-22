import {complete, CompletionItem, trimTokenVector} from "./completion";
import {DescriptionDictionary} from "./completion/descriptionDictionary";
import {BooleanData} from "./data/boolean";
import {Dictionary} from "./data/dictionary";
import {StringData} from "./data/string";
import {wellKnownFunctions} from "./funcs";
import {FunctionDefinition, FunctionInfo} from "./funcs/info";
import {Lexer, TokenType} from "./lexer";

const testContext = new Dictionary(
  {
    key: "env",
    value: new Dictionary(
      {
        key: "FOO",
        value: new StringData("")
      },
      {
        key: "BAR_TEST",
        value: new StringData("")
      }
    )
  },
  {
    key: "github",
    value: new DescriptionDictionary(
      {
        key: "actor",
        value: new StringData(""),
        description: "The name of the person or app that initiated the workflow. For example, octocat."
      },
      {
        key: "inputs",
        value: new DescriptionDictionary({
          key: "name",
          value: new StringData("monalisa"),
          description: "The name of a person"
        })
      }
    )
  },
  {
    key: "secrets",
    value: new Dictionary({
      key: "AWS_TOKEN",
      value: new BooleanData(true)
    })
  },
  {
    key: "vars",
    value: new Dictionary({
      key: "VAR_NAME",
      value: new BooleanData(true)
    })
  },
  {
    key: "hashFiles(1,255)",
    value: new Dictionary()
  }
);

const testFunctions: FunctionInfo[] = [];

const testComplete = (input: string, functions?: Map<string, FunctionDefinition>): CompletionItem[] => {
  const pos = input.indexOf("|");
  input = input.replace("|", "");

  const results = complete(input.slice(0, pos >= 0 ? pos : input.length), testContext, testFunctions, functions);

  return results;
};

function completionItems(...labels: string[]): CompletionItem[] {
  return labels.map(label => ({label, function: false}));
}

describe("auto-complete", () => {
  describe("top-level", () => {
    it("includes built-in functions", () => {
      const expected: CompletionItem = {
        label: "toJson",
        description:
          "`toJSON(value)`\n\nReturns a pretty-print JSON representation of `value`. You can use this function to debug the information provided in contexts.",
        function: true
      };
      expect(testComplete("to")).toContainEqual(expected);
      expect(testComplete("toJs")).toContainEqual(expected);
      expect(testComplete("1 == toJS")).toContainEqual(expected);
      expect(testComplete("1 == (toJS")).toContainEqual(expected);
      expect(testComplete("toJS| == 1")).toContainEqual(expected);
      expect(testComplete("(toJS| == (foo.bar)")).toContainEqual(expected);
      expect(testComplete("(((toJS| == (foo.bar)")).toContainEqual(expected);
    });

    it("removes parentheses from passed in function context", () => {
      expect(testComplete("|")).toContainEqual({
        label: "hashFiles",
        function: true
      });
    });
  });

  describe("in multi-line expressions", () => {
    it("includes built-in functions", () => {
      expect(testComplete("1 == (\nto").map(x => x.label)).toContainEqual("toJson");
    });
  });

  describe("functions", () => {
    it("uses provided function definitions", () => {
      expect(
        testComplete(
          "fromJson('invalid').|",
          new Map(
            Object.entries({
              fromjson: {
                ...wellKnownFunctions.fromjson,
                call: () =>
                  new Dictionary({
                    key: "foo",
                    value: new StringData("bar")
                  })
              }
            })
          )
        )
      ).toEqual<CompletionItem[]>([{label: "foo", function: false}]);
    });
  });

  describe("for contexts", () => {
    it("provides suggestions for top-level context", () => {
      const expected = completionItems("BAR_TEST", "FOO");
      expect(testComplete("env.X")).toEqual(expected);
      expect(testComplete("1 == env.F")).toEqual(expected);
      expect(testComplete("env.")).toEqual(expected);
      expect(testComplete("env.FOO")).toEqual(expected);
      expect(testComplete("(env).")).toEqual(expected);
    });

    it("provides suggestions for nested context", () => {
      const expected: CompletionItem[] = [
        {
          label: "name",
          function: false,
          description: "The name of a person"
        }
      ];
      expect(testComplete("github.inputs.|")).toEqual(expected);
      expect(testComplete("(github).inputs.|")).toEqual(expected);
      expect(testComplete("(github.inputs).|")).toEqual(expected);
      expect(testComplete("'test' == github.inputs.|")).toEqual(expected);
      expect(testComplete("github.inputs.| == 'monalisa'")).toEqual(expected);
    });

    it("provides suggestions for secrets", () => {
      const expected = completionItems("AWS_TOKEN");

      expect(testComplete("secrets.A")).toEqual(expected);
      expect(testComplete("1 == secrets.F")).toEqual(expected);
      expect(testComplete("toJSON(secrets.")).toEqual(expected);
    });

    it("provides suggestions for variables", () => {
      const expected = completionItems("VAR_NAME");

      expect(testComplete("vars.V")).toEqual(expected);
      expect(testComplete("1 == vars.F")).toEqual(expected);
      expect(testComplete("toJSON(vars.")).toEqual(expected);
    });

    it("provides suggestions for contexts in function call", () => {
      expect(testComplete("toJSON(env.|)")).toEqual(completionItems("BAR_TEST", "FOO"));
      expect(testComplete("toJSON(secrets.")).toEqual(completionItems("AWS_TOKEN"));
    });

    describe("with descriptions", () => {
      it("top-level", () => {
        expect(testComplete("github.")).toContainEqual<CompletionItem>({
          label: "actor",
          function: false,
          description: "The name of the person or app that initiated the workflow. For example, octocat."
        });
      });

      it("nested", () => {
        expect(testComplete("github.inputs.")).toContainEqual<CompletionItem>({
          label: "name",
          function: false,
          description: "The name of a person"
        });
      });
    });
  });
});

describe("trimTokenVector", () => {
  test.each<{
    input: string;
    expected: TokenType[];
  }>([
    {
      input: "env.",
      expected: [TokenType.IDENTIFIER, TokenType.DOT, TokenType.EOF]
    },
    {
      input: "github.act",
      expected: [TokenType.IDENTIFIER, TokenType.DOT, TokenType.IDENTIFIER, TokenType.EOF]
    },
    {
      input: "1 == github.act",
      expected: [TokenType.IDENTIFIER, TokenType.DOT, TokenType.IDENTIFIER, TokenType.EOF]
    },
    {
      input: "github.mona == github.act",
      expected: [TokenType.IDENTIFIER, TokenType.DOT, TokenType.IDENTIFIER, TokenType.EOF]
    },
    {
      input: "github.mona == (github).act",
      expected: [
        TokenType.LEFT_PAREN,
        TokenType.IDENTIFIER,
        TokenType.RIGHT_PAREN,
        TokenType.DOT,
        TokenType.IDENTIFIER,
        TokenType.EOF
      ]
    },
    {
      input: "github.mona == (github.",
      expected: [TokenType.IDENTIFIER, TokenType.DOT, TokenType.EOF]
    },
    {
      input: "github['test'].",
      expected: [
        TokenType.IDENTIFIER,
        TokenType.LEFT_BRACKET,
        TokenType.STRING,
        TokenType.RIGHT_BRACKET,
        TokenType.DOT,
        TokenType.EOF
      ]
    }
  ])("$input", ({input, expected}) => {
    const l = new Lexer(input);
    const lr = l.lex();

    const tv = trimTokenVector(lr.tokens);
    expect(tv.map(x => x.type)).toEqual(expected);
  });
});
