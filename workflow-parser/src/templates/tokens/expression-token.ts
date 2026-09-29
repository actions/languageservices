import {Lexer, Parser} from "@actions/expressions";
import {splitAllowedContext} from "../allowed-context.js";
import {DefinitionInfo} from "../schema/definition-info.js";
import {ScalarToken} from "./scalar-token.js";
import {TokenRange} from "./token-range.js";

export abstract class ExpressionToken extends ScalarToken {
  public readonly directive: string | undefined;

  public constructor(
    type: number,
    file: number | undefined,
    range: TokenRange | undefined,
    directive: string | undefined,
    definitionInfo: DefinitionInfo | undefined
  ) {
    super(type, file, range, definitionInfo);
    this.directive = directive;
  }

  public override get isLiteral(): boolean {
    return false;
  }

  public override get isExpression(): boolean {
    return true;
  }

  public static validateExpression(expression: string, allowedContext: string[]): void {
    const {namedContexts, functions} = splitAllowedContext(allowedContext);

    // Parse
    const lexer = new Lexer(expression);
    const result = lexer.lex();
    const p = new Parser(result.tokens, namedContexts, functions);
    p.parse();
  }
}
