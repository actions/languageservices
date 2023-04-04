import {Lexer, Parser} from "@actions/expressions";
import {Dictionary} from "@actions/expressions/data/dictionary";
import {StringData} from "@actions/expressions/data/string";
import {splitAllowedContext} from "@actions/workflow-parser/templates/allowed-context";
import {ValidationVisitor} from "./visitor";

const testContext = new Dictionary({
  key: "github",
  value: new Dictionary(
    {
      key: "event",
      value: new StringData("push")
    },
    {
      key: "repo",
      value: new Dictionary({
        key: "name",
        value: new StringData("test")
      })
    }
  )
});

function useVisitor(expression: string, allowedContext: string[]): any[] {
  const {namedContexts, functions} = splitAllowedContext(allowedContext);

  const l = new Lexer(expression);
  const lr = l.lex();

  const p = new Parser(lr.tokens, namedContexts, functions);
  const expr = p.parse();

  const e = new ValidationVisitor(expr, testContext);
  e.validate();

  return e.errors;
}

describe("validation visitor", () => {
  it("invalid context access", () => {
    expect(useVisitor("github.foo", ["github"])).toEqual([
      {
        message: "Context access might be invalid: foo",
        range: {
          end: {
            column: 10,
            line: 0
          },
          start: {
            column: 0,
            line: 0
          }
        },
        severity: "warning"
      }
    ]);
  });

  it("invalid nested context access", () => {
    expect(useVisitor("github.repo.name", ["github"])).toEqual([
      {
        message: "Context access might be invalid: name",
        range: {
          end: {
            column: 16,
            line: 0
          },
          start: {
            column: 0,
            line: 0
          }
        },
        severity: "warning"
      }
    ]);
  });

  it("invalid context accesses", () => {
    expect(useVisitor("github.foo || github.foo.bar", ["github"])).toEqual([
      {
        message: "Context access might be invalid: foo",
        range: {
          end: {
            column: 10,
            line: 0
          },
          start: {
            column: 0,
            line: 0
          }
        },
        severity: "warning"
      },
      {
        message: "Context access might be invalid: bar",
        range: {
          end: {
            column: 28,
            line: 0
          },
          start: {
            column: 14,
            line: 0
          }
        },
        severity: "warning"
      }
    ]);
  });
});
