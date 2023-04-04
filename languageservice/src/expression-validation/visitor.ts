import {DescriptionDictionary} from "@actions/expressions";
import {
  Binary,
  ContextAccess,
  Expr,
  ExprVisitor,
  FunctionCall,
  Grouping,
  IndexAccess,
  Literal,
  Logical,
  Unary
} from "@actions/expressions/ast";
import {Dictionary} from "@actions/expressions/data/dictionary";
import {ExpressionData} from "@actions/expressions/data/expressiondata";
import {Range} from "@actions/expressions/lexer";

export type ValidationError = {
  range: Range;
  message: string;
  severity: "error" | "warning";
};

export class ValidationVisitor implements ExprVisitor<void> {
  public readonly errors: ValidationError[] = [];

  constructor(private expr: Expr, private context: Dictionary) {}

  validate(): void {
    this._validate(this.expr);
  }

  private _validate(expr: Expr) {
    expr.accept(this);
  }

  visitLiteral() {
    return undefined;
  }

  visitUnary(unary: Unary) {
    this._validate(unary.expr);
  }

  visitBinary(binary: Binary) {
    this._validate(binary.left);
    this._validate(binary.right);
  }

  visitLogical(logical: Logical) {
    for (const arg of logical.args) {
      this._validate(arg);
    }
  }

  visitGrouping(grouping: Grouping) {
    this._validate(grouping.group);
  }

  visitContextAccess(contextAccess: ContextAccess) {
    const contextName = contextAccess.name.lexeme;
    if (this.context.get(contextName) === undefined) {
      this.errors.push({
        message: `Context access might be invalid: ${contextName}`,
        range: contextAccess.name.range,
        severity: "error"
      });
    }
  }

  visitIndexAccess(indexAccess: IndexAccess) {
    let contextAccess: ContextAccess | undefined;

    const s: ExpressionData[] = [];
    let i: Expr = indexAccess;
    while (i) {
      if (i instanceof IndexAccess) {
        if (!(i.index instanceof Literal)) {
          // Not a literal, validate independently
          this._validate(i.index);
          return;
        }
        s.push(i.index.literal);
        i = i.expr;
      }

      if (i instanceof ContextAccess) {
        contextAccess = i;
        break;
      }
    }

    if (!contextAccess) {
      // Context not found, should not happen, ignore in this case
      return;
    }

    const contextName = contextAccess.name.lexeme;
    let contextValue = this.context.get(contextName);
    if (contextValue === undefined || !(contextValue instanceof Dictionary)) {
      const contextName = contextAccess.name.lexeme;
      if (this.context.get(contextName) === undefined) {
        this.errors.push({
          message: `Context access might be invalid: ${contextName}`,
          range: contextAccess.name.range,
          severity: "warning"
        });
      }
      return;
    }

    while (s.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const idx = s.pop()!;

      const key = idx.coerceString();
      const v: ExpressionData | undefined = contextValue.get(key);
      if (v === undefined) {
        if (contextValue instanceof DescriptionDictionary && !contextValue.complete) {
          // If the context dictionary is not complete, we cannot validate the expression
          return;
        }

        this.errors.push({
          range: {
            start: contextAccess.name.range.start,
            end: (indexAccess.index as Literal).token.range.end
          },
          message: `Context access might be invalid: ${key}`,
          severity: "warning"
        });
        return;
      }

      if (!(v instanceof Dictionary)) {
        return;
      }

      contextValue = v;
    }
  }

  visitFunctionCall(functionCall: FunctionCall) {
    for (const arg of functionCall.args) {
      this._validate(arg);
    }
  }
}
