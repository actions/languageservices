import {Lexer, Token, TokenType} from "./lexer.js";

describe("lexer", () => {
  const tests: {
    input: string;
    tokenTypes: TokenType[];
    tokens?: Token[];
  }[] = [
    {input: "<", tokenTypes: [TokenType.LESS]},
    {input: ">", tokenTypes: [TokenType.GREATER]},

    {input: "!=", tokenTypes: [TokenType.BANG_EQUAL]},
    {input: "==", tokenTypes: [TokenType.EQUAL_EQUAL]},
    {input: "<=", tokenTypes: [TokenType.LESS_EQUAL]},
    {input: ">=", tokenTypes: [TokenType.GREATER_EQUAL]},

    {input: "&&", tokenTypes: [TokenType.AND]},
    {input: "||", tokenTypes: [TokenType.OR]},

    // Numbers
    {input: "12", tokenTypes: [TokenType.NUMBER]},
    {input: "12.0", tokenTypes: [TokenType.NUMBER]},
    {input: "0", tokenTypes: [TokenType.NUMBER]},
    {input: "-0", tokenTypes: [TokenType.NUMBER]},
    {input: "-12.0", tokenTypes: [TokenType.NUMBER]},

    // Strings
    {input: "'It''s okay'", tokenTypes: [TokenType.STRING]},
    {
      input: "format('{0} == ''queued''', needs)",
      tokenTypes: [
        TokenType.IDENTIFIER,
        TokenType.LEFT_PAREN,
        TokenType.STRING,
        TokenType.COMMA,
        TokenType.IDENTIFIER,
        TokenType.RIGHT_PAREN
      ]
    },

    // Arrays
    {
      input: "[1,2]",
      tokenTypes: [TokenType.LEFT_BRACKET, TokenType.NUMBER, TokenType.COMMA, TokenType.NUMBER, TokenType.RIGHT_BRACKET]
    },

    // Simple expressions
    {
      input: "1 == 2",
      tokenTypes: [TokenType.NUMBER, TokenType.EQUAL_EQUAL, TokenType.NUMBER]
    },
    {
      input: "1== 1",
      tokenTypes: [TokenType.NUMBER, TokenType.EQUAL_EQUAL, TokenType.NUMBER]
    },
    {
      input: "1< 1",
      tokenTypes: [TokenType.NUMBER, TokenType.LESS, TokenType.NUMBER]
    },

    // Identifiers
    {
      input: "github",
      tokenTypes: [TokenType.IDENTIFIER],
      tokens: [
        {
          type: TokenType.IDENTIFIER,
          lexeme: "github",
          range: {
            start: {
              line: 0,
              column: 0
            },
            end: {
              line: 0,
              column: 6
            }
          }
        }
      ]
    },

    // Keywords
    {
      input: "true",
      tokenTypes: [TokenType.TRUE],
      tokens: [
        {
          type: TokenType.TRUE,
          lexeme: "true",
          range: {
            start: {
              line: 0,
              column: 0
            },
            end: {
              line: 0,
              column: 4
            }
          }
        }
      ]
    },

    {
      input: "false",
      tokenTypes: [TokenType.FALSE],
      tokens: [
        {
          type: TokenType.FALSE,
          lexeme: "false",
          range: {
            start: {
              line: 0,
              column: 0
            },
            end: {
              line: 0,
              column: 5
            }
          }
        }
      ]
    },

    {
      input: "null",
      tokenTypes: [TokenType.NULL],
      tokens: [
        {
          type: TokenType.NULL,
          lexeme: "null",
          range: {
            start: {
              line: 0,
              column: 0
            },
            end: {
              line: 0,
              column: 4
            }
          }
        }
      ]
    },

    {
      input: "github\n ==",
      tokenTypes: [TokenType.IDENTIFIER, TokenType.EQUAL_EQUAL],
      tokens: [
        {
          type: TokenType.IDENTIFIER,
          lexeme: "github",
          range: {
            start: {
              line: 0,
              column: 0
            },
            end: {
              line: 0,
              column: 6
            }
          }
        },
        {
          type: TokenType.EQUAL_EQUAL,
          lexeme: "==",
          range: {
            start: {
              line: 1,
              column: 1
            },
            end: {
              line: 1,
              column: 3
            }
          }
        }
      ]
    }
  ];

  test.each(tests)(
    "$input",
    ({input, tokenTypes, tokens}: {input: string; tokenTypes: TokenType[]; tokens?: Token[]}) => {
      const l = new Lexer(input);

      const r = l.lex();

      const got = r.tokens.map(t => t.type);

      tokenTypes.push(TokenType.EOF);
      expect(got).toEqual(tokenTypes);

      if (tokens) {
        // Ignore the last EOF token
        expect(r.tokens.slice(0, r.tokens.length - 1)).toEqual(tokens);
      }
    }
  );
});
