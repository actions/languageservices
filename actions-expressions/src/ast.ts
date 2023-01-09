import { ExpressionData } from "./data";
import { Token } from "./lexer";

export interface ExprVisitor<R> {
  visitLiteral(literal: Literal): R;
  visitUnary(unary: Unary): R;
  visitBinary(binary: Binary): R;
  visitLogical(binary: Logical): R;
  visitGrouping(grouping: Grouping): R;
  visitContextAccess(contextAccess: ContextAccess): R;
  visitIndexAccess(indexAccess: IndexAccess): R;
  visitFunctionCall(functionCall: FunctionCall): R;
}

export abstract class Expr {
  abstract accept<R>(v: ExprVisitor<R>): R;
}

export class Literal extends Expr {
  constructor(public literal: ExpressionData) {
    super();
  }

  accept<R>(v: ExprVisitor<R>): R {
    return v.visitLiteral(this);
  }
}

export class Unary extends Expr {
  constructor(public operator: Token, public expr: Expr) {
    super();
  }

  accept<R>(v: ExprVisitor<R>): R {
    return v.visitUnary(this);
  }
}

export class FunctionCall extends Expr {
  constructor(public functionName: Token, public args: Expr[]) {
    super();
  }

  accept<R>(v: ExprVisitor<R>): R {
    return v.visitFunctionCall(this);
  }
}

export class Binary extends Expr {
  constructor(public left: Expr, public operator: Token, public right: Expr) {
    super();
  }

  accept<R>(v: ExprVisitor<R>): R {
    return v.visitBinary(this);
  }
}

export class Logical extends Expr {
  constructor(public operator: Token, public args: Expr[]) {
    super();
  }

  accept<R>(v: ExprVisitor<R>): R {
    return v.visitLogical(this);
  }
}

export class Grouping extends Expr {
  constructor(public group: Expr) {
    super();
  }

  accept<R>(v: ExprVisitor<R>): R {
    return v.visitGrouping(this);
  }
}

export class ContextAccess extends Expr {
  constructor(public name: Token) {
    super();
  }

  accept<R>(v: ExprVisitor<R>): R {
    return v.visitContextAccess(this);
  }
}

export class IndexAccess extends Expr {
  constructor(public expr: Expr, public index: Expr) {
    super();
  }

  accept<R>(v: ExprVisitor<R>): R {
    return v.visitIndexAccess(this);
  }
}

export class Star extends Expr {
  accept<R>(v: ExprVisitor<R>): R {
    throw new Error("Method not implemented.");
  }
}
