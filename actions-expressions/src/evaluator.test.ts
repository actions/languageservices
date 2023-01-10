import * as data from "./data";
import {Evaluator} from "./evaluator";
import {Lexer} from "./lexer";
import {Parser} from "./parser";

test("evaluator", () => {
  const input = "foo['']";

  const lexer = new Lexer(input);
  const result = lexer.lex();

  // Parse
  const parser = new Parser(result.tokens, ["foo"], []);
  const expr = parser.parse();

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
