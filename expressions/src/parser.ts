import {Binary, ContextAccess, Expr, FunctionCall, Grouping, IndexAccess, Literal, Logical, Star, Unary} from "./ast.js";
import * as data from "./data/index.js";
import {ErrorType, ExpressionError, MAX_PARSER_DEPTH} from "./errors.js";
import {ParseContext, validateFunction} from "./funcs.js";
import {FunctionInfo} from "./funcs/info.js";
import {Token, TokenType} from "./lexer.js";

export class Parser {
  private extContexts: Map<string, boolean>;
  private extFuncs: Map<string, FunctionInfo>;

  private offset = 0;
  private depth = 0;

  private context: ParseContext;

  /**
   * Constructs a new parser for the given tokens
   *
   * @param tokens Tokens to build a parse tree from
   * @param extensionContexts Available context names
   * @param extensionFunctions Available functions (beyond the built-in ones)
   */
  constructor(private tokens: Token[], extensionContexts: string[], extensionFunctions: FunctionInfo[]) {
    this.extContexts = new Map<string, boolean>();
    this.extFuncs = new Map();

    for (const contextName of extensionContexts) {
      this.extContexts.set(contextName.toLowerCase(), true);
    }

    for (const {name, func} of extensionFunctions.map(x => ({
      name: x.name,
      func: x
    }))) {
      this.extFuncs.set(name.toLowerCase(), func);
    }

    this.context = {
      allowUnknownKeywords: false,
      extensionContexts: this.extContexts,
      extensionFunctions: this.extFuncs
    };
  }

  public parse(): Expr {
    // eslint-disable-next-line prefer-const
    let result!: Expr;

    // No tokens
    if (this.atEnd()) {
      return result;
    }

    result = this.expression();

    if (!this.atEnd()) {
      throw this.buildError(ErrorType.ErrorUnexpectedSymbol, this.peek());
    }

    return result;
  }

  private expression(): Expr {
    this.incrDepth();

    try {
      return this.logicalOr();
    } finally {
      this.decrDepth();
    }
  }

  private logicalOr(): Expr {
    // && is higher precedence than ||
    let expr = this.logicalAnd();

    if (this.check(TokenType.OR)) {
      // Track depth
      this.incrDepth();

      try {
        const logical = new Logical(this.peek(), [expr]);
        expr = logical;

        while (this.match(TokenType.OR)) {
          const right = this.logicalAnd();
          logical.args.push(right);
        }
      } finally {
        this.decrDepth();
      }
    }

    return expr;
  }

  private logicalAnd(): Expr {
    // == and != are higher precedence than &&
    let expr = this.equality();

    if (this.check(TokenType.AND)) {
      // Track depth
      this.incrDepth();

      try {
        const logical = new Logical(this.peek(), [expr]);
        expr = logical;

        while (this.match(TokenType.AND)) {
          const right = this.equality();
          logical.args.push(right);
        }
      } finally {
        this.decrDepth();
      }
    }

    return expr;
  }

  private equality(): Expr {
    // >, >=, <, <= are higher precedence than == and !=
    let expr = this.comparison();

    while (this.match(TokenType.BANG_EQUAL, TokenType.EQUAL_EQUAL)) {
      const operator = this.previous();
      const right = this.comparison();

      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  private comparison(): Expr {
    // ! is higher precedence than >, >=, <, <=
    let expr = this.unary();

    while (this.match(TokenType.GREATER, TokenType.GREATER_EQUAL, TokenType.LESS, TokenType.LESS_EQUAL)) {
      const operator = this.previous();
      const right = this.unary();

      expr = new Binary(expr, operator, right);
    }

    return expr;
  }

  private unary(): Expr {
    if (this.match(TokenType.BANG)) {
      // Track depth
      this.incrDepth();

      const operator = this.previous();
      const unary = this.unary();

      try {
        return new Unary(operator, unary);
      } finally {
        this.decrDepth();
      }
    }

    return this.index();
  }

  private index(): Expr {
    let expr = this.call();

    let depthIncreased = 0;

    if (expr instanceof Grouping || expr instanceof FunctionCall || expr instanceof ContextAccess) {
      let cont = true;
      while (cont) {
        switch (true) {
          case this.match(TokenType.LEFT_BRACKET): {
            let indexExpr: Expr;
            if (this.match(TokenType.STAR)) {
              indexExpr = new Star();
            } else {
              indexExpr = this.expression();
            }

            this.consume(TokenType.RIGHT_BRACKET, ErrorType.ErrorUnexpectedSymbol);

            // Track depth
            this.incrDepth();
            depthIncreased++;
            expr = new IndexAccess(expr, indexExpr);
            break;
          }

          case this.match(TokenType.DOT):
            // Track depth
            this.incrDepth();
            depthIncreased++;

            if (this.match(TokenType.IDENTIFIER)) {
              const property = this.previous();
              expr = new IndexAccess(expr, new Literal(new data.StringData(property.lexeme), property));
            } else if (this.match(TokenType.STAR)) {
              expr = new IndexAccess(expr, new Star());
            } else {
              throw this.buildError(ErrorType.ErrorUnexpectedSymbol, this.peek());
            }

            break;

          default:
            cont = false;
        }
      }
    }

    for (let i = 0; i < depthIncreased; i++) {
      this.decrDepth();
    }

    return expr;
  }

  private call(): Expr {
    if (!this.check(TokenType.IDENTIFIER)) {
      return this.primary();
    }

    const identifier = this.next();

    if (!this.match(TokenType.LEFT_PAREN)) {
      if (!this.extContexts.has(identifier.lexeme.toLowerCase())) {
        throw this.buildError(ErrorType.ErrorUnrecognizedContext, identifier);
      }
      return new ContextAccess(identifier);
    }

    // Function call
    const args: Expr[] = [];

    // Arguments
    while (!this.match(TokenType.RIGHT_PAREN)) {
      const aexp = this.expression();

      args.push(aexp);

      if (!this.check(TokenType.RIGHT_PAREN)) {
        this.consume(TokenType.COMMA, ErrorType.ErrorUnexpectedSymbol);
      }
    }

    validateFunction(this.context, identifier, args.length);

    return new FunctionCall(identifier, args);
  }

  private primary(): Expr {
    switch (true) {
      case this.match(TokenType.FALSE):
        return new Literal(new data.BooleanData(false), this.previous());

      case this.match(TokenType.TRUE):
        return new Literal(new data.BooleanData(true), this.previous());

      case this.match(TokenType.NULL):
        return new Literal(new data.Null(), this.previous());

      case this.match(TokenType.NUMBER):
        return new Literal(new data.NumberData(this.previous().value as number), this.previous());

      case this.match(TokenType.STRING):
        return new Literal(new data.StringData(this.previous().value as string), this.previous());

      case this.match(TokenType.LEFT_PAREN): {
        const expr = this.expression();

        if (this.atEnd()) {
          throw this.buildError(ErrorType.ErrorUnexpectedEndOfExpression, this.previous()); // Back up to get the last token before the EOF
        }

        this.consume(TokenType.RIGHT_PAREN, ErrorType.ErrorUnexpectedSymbol);
        return new Grouping(expr);
      }
      case this.atEnd():
        throw this.buildError(ErrorType.ErrorUnexpectedEndOfExpression, this.previous()); // Back up to get the last token before the EOF
    }

    throw this.buildError(ErrorType.ErrorUnexpectedSymbol, this.peek());
  }

  // match consumes the next token if it matches any of the given types
  private match(...tokenTypes: TokenType[]): boolean {
    for (const tokenType of tokenTypes) {
      if (this.check(tokenType)) {
        this.next();
        return true;
      }
    }

    return false;
  }

  // check peeks whether the next token is of the given type
  private check(tokenType: TokenType): boolean {
    if (this.atEnd()) {
      return false;
    }

    return this.peek().type == tokenType;
  }

  // atEnd peeks whether the next token is EOF
  private atEnd(): boolean {
    return this.peek().type == TokenType.EOF;
  }

  private next(): Token {
    if (!this.atEnd()) {
      this.offset++;
    }

    return this.previous();
  }

  private peek(): Token {
    return this.tokens[this.offset];
  }

  // previous returns the previous token
  private previous(): Token {
    return this.tokens[this.offset - 1];
  }

  // consume attempts to consume the next token if it matches the given type. It returns an error of
  // the given ParseErrorKind otherwise.
  private consume(tokenType: TokenType, errorType: ErrorType) {
    if (this.check(tokenType)) {
      this.next();
      return;
    }

    throw this.buildError(errorType, this.peek());
  }

  private incrDepth() {
    this.depth++;
    if (this.depth > MAX_PARSER_DEPTH) {
      throw this.buildError(ErrorType.ErrorExceededMaxDepth, this.peek());
    }
  }

  private decrDepth() {
    this.depth--;
  }

  private buildError(errType: ErrorType, token: Token): Error {
    return new ExpressionError(errType, token);
  }
}
