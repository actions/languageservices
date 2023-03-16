import {Expr} from "./ast";
import * as data from "./data";
import {ExpressionEvaluationError} from "./errors";
import {Evaluator} from "./evaluator";
import {Lexer} from "./lexer";
import {Parser} from "./parser";

function assertDefined(x: Expr | undefined): asserts x is Expr {
  expect(x).toBeDefined();
}

describe("evaluator", () => {
  const lexAndParse = (input: string) => {
    const lexer = new Lexer(input);
    const result = lexer.lex();

    // Parse
    const parser = new Parser(result.tokens, ["foo"], []);
    const expr = parser.parse();
    assertDefined(expr);
    return expr;
  };

  it("basic evaluation", () => {
    const expr = lexAndParse("foo['']");

    // Evaluate expression
    const evaluator = new Evaluator(
      expr,
      new data.Dictionary({
        key: "foo",
        value: new data.Dictionary({key: "bar", value: new data.NumberData(42)})
      })
    );
    const eresult = evaluator.evaluate();

    expect(eresult.kind).toBe(data.Kind.Null);
  });

  it("handle runtime errors", () => {
    const expr = lexAndParse("fromJson('test') == 123");
    const evaluator = new Evaluator(expr, new data.Dictionary());

    expect(() => evaluator.evaluate()).toThrowError(
      new ExpressionEvaluationError("Error parsing JSON when evaluating fromJson")
    );
  });
});
