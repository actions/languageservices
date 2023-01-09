import { Lexer, Token, TokenType } from "./lexer";

describe("lexer", () => {
  const tests: {
    input: string;
    tokenType: TokenType[];
    token?: Token;
  }[] = [
    { input: "<", tokenType: [TokenType.LESS] },
    { input: ">", tokenType: [TokenType.GREATER] },

    { input: "!=", tokenType: [TokenType.BANG_EQUAL] },
    { input: "==", tokenType: [TokenType.EQUAL_EQUAL] },
    { input: "<=", tokenType: [TokenType.LESS_EQUAL] },
    { input: ">=", tokenType: [TokenType.GREATER_EQUAL] },

    { input: "&&", tokenType: [TokenType.AND] },
    { input: "||", tokenType: [TokenType.OR] },

    // Numbers
    { input: "12", tokenType: [TokenType.NUMBER] },
    { input: "12.0", tokenType: [TokenType.NUMBER] },
    { input: "0", tokenType: [TokenType.NUMBER] },
    { input: "-0", tokenType: [TokenType.NUMBER] },
    { input: "-12.0", tokenType: [TokenType.NUMBER] },

    // Strings
    { input: "'It''s okay'", tokenType: [TokenType.STRING] },
    {
      input: "format('{0} == ''queued''', needs)",
      tokenType: [
        TokenType.IDENTIFIER,
        TokenType.LEFT_PAREN,
        TokenType.STRING,
        TokenType.COMMA,
        TokenType.IDENTIFIER,
        TokenType.RIGHT_PAREN,
      ],
    },

    // Arrays
    {
      input: "[1,2]",
      tokenType: [
        TokenType.LEFT_BRACKET,
        TokenType.NUMBER,
        TokenType.COMMA,
        TokenType.NUMBER,
        TokenType.RIGHT_BRACKET,
      ],
    },

    // Simple expressions
    {
      input: "1 == 2",
      tokenType: [TokenType.NUMBER, TokenType.EQUAL_EQUAL, TokenType.NUMBER],
    },
    {
      input: "1== 1",
      tokenType: [TokenType.NUMBER, TokenType.EQUAL_EQUAL, TokenType.NUMBER],
    },
    {
      input: "1< 1",
      tokenType: [TokenType.NUMBER, TokenType.LESS, TokenType.NUMBER],
    },

    // Identifiers
    {
      input: "github",
      tokenType: [TokenType.IDENTIFIER],
      token: {
        type: TokenType.IDENTIFIER,
        lexeme: "github",
        pos: {
          line: 0,
          column: 0,
        },
      },
    },

    // Keywords
    {
      input: "true",
      tokenType: [TokenType.TRUE],
      token: {
        type: TokenType.TRUE,
        lexeme: "true",
        pos: {
          line: 0,
          column: 0,
        },
      },
    },

    {
      input: "false",
      tokenType: [TokenType.FALSE],
      token: {
        type: TokenType.FALSE,
        lexeme: "false",
        pos: {
          line: 0,
          column: 0,
        },
      },
    },

    {
      input: "null",
      tokenType: [TokenType.NULL],
      token: {
        type: TokenType.NULL,
        lexeme: "null",
        pos: {
          line: 0,
          column: 0,
        },
      },
    },
  ];

  test.each(tests)(
    "$input",
    ({
      input,
      tokenType,
      token,
    }: {
      input: string;
      tokenType: TokenType[];
      token?: Token;
    }) => {
      const l = new Lexer(input);

      const r = l.lex();

      const want = r.tokens.map((t) => t.type);

      tokenType.push(TokenType.EOF);

      expect(want).toEqual(tokenType);
    }
  );
});
