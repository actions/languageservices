import {complete, CompletionItem, trimTokenVector} from "./completion";
import {BooleanData} from "./data/boolean";
import {Dictionary} from "./data/dictionary";
import {StringData} from "./data/string";
import {FunctionInfo} from "./funcs/info";
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
    key: "secrets",
    value: new Dictionary({
      key: "AWS_TOKEN",
      value: new BooleanData(true)
    })
  },
  {
    key: "hashFiles(1,255)",
    value: new Dictionary()
  }
);

const testFunctions: FunctionInfo[] = [];

const testComplete = (input: string): CompletionItem[] => {
  const pos = input.indexOf("|");
  input = input.replace("|", "");

  const results = complete(input.slice(0, pos >= 0 ? pos : input.length), testContext, testFunctions);

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
      expect(testComplete("toJS| == 1")).toContainEqual(expected);
    });

    it("removes parentheses from passed in function context", () => {
      expect(testComplete("|")).toContainEqual({
        label: "hashFiles",
        function: true
      });
    });
  });

  describe("for contexts", () => {
    it("provides suggestions for env", () => {
      const expected = completionItems("BAR_TEST", "FOO");
      expect(testComplete("env.X")).toEqual(expected);
      expect(testComplete("1 == env.F")).toEqual(expected);
      expect(testComplete("env.")).toEqual(expected);
      expect(testComplete("env.FOO")).toEqual(expected);
    });

    it("provides suggestions for secrets", () => {
      const expected = completionItems("AWS_TOKEN");

      expect(testComplete("secrets.A")).toEqual(expected);
      expect(testComplete("1 == secrets.F")).toEqual(expected);
      expect(testComplete("toJSON(secrets.")).toEqual(expected);
    });

    it("provides suggestions for contexts in function call", () => {
      expect(testComplete("toJSON(env.|)")).toEqual(completionItems("BAR_TEST", "FOO"));
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
