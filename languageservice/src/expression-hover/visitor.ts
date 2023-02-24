import {DescriptionDictionary, Evaluator, isDescriptionDictionary, wellKnownFunctions} from "@actions/expressions";
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
import {FunctionDefinition} from "@actions/expressions/funcs/info";
import {Pos, Range} from "@actions/expressions/lexer";
import {posWithinRange} from "./pos-range";

export type HoverResult =
  | undefined
  | {
      label: string;
      description?: string;
      function: boolean;
      range: Range;
    };

export class HoverVisitor implements ExprVisitor<HoverResult> {
  private ignorePosCheck = false;

  constructor(
    private pos: Pos,
    private context: DescriptionDictionary,
    private functions: Map<string, FunctionDefinition>
  ) {}

  hover(n: Expr): HoverResult {
    return n.accept(this);
  }

  visitLiteral(): HoverResult {
    return undefined;
  }

  visitUnary(unary: Unary): HoverResult {
    return this.hover(unary.expr);
  }

  visitBinary(binary: Binary): HoverResult {
    return this.hover(binary.left) || this.hover(binary.right);
  }

  visitLogical(logical: Logical): HoverResult {
    for (const arg of logical.args) {
      const result = this.hover(arg);
      if (result) {
        return result;
      }
    }

    return undefined;
  }

  visitGrouping(grouping: Grouping): HoverResult {
    return this.hover(grouping.group);
  }

  visitContextAccess(contextAccess: ContextAccess): HoverResult {
    if (this.ignorePosCheck || posWithinRange(this.pos, contextAccess.name.range)) {
      const contextName = contextAccess.name.lexeme;

      return {
        label: contextName,
        description: this.context.getDescription(contextName),
        function: false,
        range: contextAccess.name.range
      };
    }

    return undefined;
  }

  visitIndexAccess(indexAccess: IndexAccess): HoverResult {
    // Is the position within the index, so for example:
    // github.event.test
    //                ^ - pos
    if (!(indexAccess.index instanceof Literal)) {
      // No support for context access of the form github[github.event]
      return undefined;
    }

    if (!posWithinRange(this.pos, indexAccess.index.token.range)) {
      // Try to get hover from the rest of the expression
      return this.hover(indexAccess.expr);
    }

    const ev = new Evaluator(indexAccess.expr, this.context, this.functions);
    const result = ev.evaluate();

    if (!isDescriptionDictionary(result)) {
      // No description to show
      return undefined;
    }

    const key = indexAccess.index.literal.coerceString();
    const description = result.getDescription(key);
    if (!description) {
      return undefined;
    }

    // Calculate context access range for whole expression. For example:
    // github.event.test
    //         ^ - pos
    // should return the range:
    // github.event.test
    // ^^^^^^^^^^^^
    this.ignorePosCheck = true;

    try {
      const contextHover = this.hover(indexAccess.expr);
      if (!contextHover) {
        throw new Error("Expected context hover to be defined");
      }

      return {
        label: key,
        description: description,
        function: false,
        range: {
          start: contextHover.range.start,
          end: indexAccess.index.token.range.end
        }
      };
    } finally {
      this.ignorePosCheck = false;
    }
  }

  visitFunctionCall(functionCall: FunctionCall): HoverResult {
    if (posWithinRange(this.pos, functionCall.functionName.range)) {
      const functionName = functionCall.functionName.lexeme.toLowerCase();
      const f = this.functions.get(functionName) || wellKnownFunctions[functionName];

      return {
        label: f.name,
        description: f.description,
        function: true,
        range: functionCall.functionName.range
      };
    }

    for (const args of functionCall.args) {
      const result = this.hover(args);
      if (result) {
        return result;
      }
    }

    return undefined;
  }
}
