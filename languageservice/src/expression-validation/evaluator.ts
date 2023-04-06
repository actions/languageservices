import {Evaluator, ExpressionEvaluationError, data} from "@actions/expressions";
import {Expr, Logical} from "@actions/expressions/ast";
import {ExpressionData} from "@actions/expressions/data/expressiondata";
import {TokenType} from "@actions/expressions/lexer";
import {falsy, truthy} from "@actions/expressions/result";
import {AccessError} from "./error-dictionary";

export type ValidationError = {
  message: string;
  severity: "error" | "warning";
};

export class ValidationEvaluator extends Evaluator {
  public readonly errors: ValidationError[] = [];

  public validate() {
    super.evaluate();
  }

  protected override eval(n: Expr): ExpressionData {
    try {
      return super.eval(n);
    } catch (e) {
      // Record error
      if (e instanceof AccessError) {
        this.errors.push({
          message: `Context access might be invalid: ${e.keyName}`,
          severity: "warning"
        });
      } else if (e instanceof ExpressionEvaluationError) {
        this.errors.push({
          message: `Expression might be invalid: ${e.message}`,
          severity: "error"
        });
      }
    }

    // Return null but continue with the validation
    return new data.Null();
  }

  override visitLogical(logical: Logical): ExpressionData {
    let result: data.ExpressionData | undefined;

    for (const arg of logical.args) {
      const r = this.eval(arg);

      // Simulate short-circuit behavior but continue to evalute all arguments for validation purposes
      if (
        !result &&
        ((logical.operator.type === TokenType.AND && falsy(r)) || (logical.operator.type === TokenType.OR && truthy(r)))
      ) {
        result = r;
      }
    }

    // result is always assigned before we return here
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return result!;
  }
}
