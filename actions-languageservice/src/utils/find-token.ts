import {isString} from "@github/actions-workflow-parser";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/index";
import {MappingToken} from "@github/actions-workflow-parser/templates/tokens/mapping-token";
import {SequenceToken} from "@github/actions-workflow-parser/templates/tokens/sequence-token";
import {TokenType} from "@github/actions-workflow-parser/templates/tokens/types";
import {Position} from "vscode-languageserver-textdocument";

export function findInnerToken(pos: Position, root?: TemplateToken) {
  const {token} = findToken(pos, root);
  return token;
}

export type TokenResult = {
  token: TemplateToken | null;
  keyToken: TemplateToken | null;
  parent: TemplateToken | null;
};

/**
 * Find a token at the given position in the document.
 *
 * If the position is within
 * - the key of a mapping, parent will be the mapping, keyToken will be null, and token will be the key.
 * - the value of a mapping, parent will be the mapping, keyToken will be the key for the value, and token will be the value
 * - a sequence item, parent will be the sequence, keyToken will be null, and token will be the item
 *
 * @param pos Position within the document for which to find a token
 * @param root Root node
 * @returns Token result
 */
export function findToken(pos: Position, root?: TemplateToken): TokenResult {
  if (!root) {
    return {
      token: null,
      keyToken: null,
      parent: null
    };
  }

  let lastMatchingToken: TemplateToken | null = null;

  const s: TokenResult[] = [
    {
      token: root,
      keyToken: null,
      parent: null
    }
  ];

  while (s.length > 0) {
    const {parent, token, keyToken} = s.shift()!;
    if (!token) {
      break;
    }

    if (!posInToken(pos, token)) {
      continue;
    }

    // Pos is in token, remember this token
    lastMatchingToken = token;

    // Position is in token, enqueue children if there are any
    switch (token.templateTokenType) {
      case TokenType.Mapping:
        const mappingToken = token as MappingToken;
        for (let i = 0; i < mappingToken.count; i++) {
          const {key, value} = mappingToken.get(i);

          if (posInToken(pos, key)) {
            return {
              token: key,
              keyToken: null,
              parent: mappingToken
            };
          }

          // Empty nodes positions won't always match the cursor, so check if we're on the same line
          if (emptyNode(value)) {
            return {
              token: value,
              keyToken: null,
              parent: key
            };
          }

          s.push({
            token: value,
            keyToken: key,
            parent: mappingToken
          });
        }
        continue;

      case TokenType.Sequence:
        const sequenceToken = token as SequenceToken;
        for (let i = 0; i < sequenceToken.count; i++) {
          s.push({
            token: sequenceToken.get(i),
            keyToken: null,
            parent: sequenceToken
          });
        }
        continue;
    }

    return {
      token,
      keyToken,
      parent
    };
  }

  // Did not find a matching token, return the last matching token as parent
  return {
    token: null,
    parent: lastMatchingToken,
    keyToken: null
  };
}

function posInToken(pos: Position, token: TemplateToken): boolean {
  if (!token.range) {
    return false;
  }
  const r = token.range;

  // TokenRange is one-based, Position is zero-based
  const tokenLine = pos.line + 1;
  const tokenChar = pos.character + 1;

  // Check lines
  if (r.start[0] > tokenLine || tokenLine > r.end[0]) {
    return false;
  }

  // Position is within the token lines. Check character/column if pos line matches
  // start or end
  if ((r.start[0] === tokenLine && tokenChar < r.start[1]) || (r.end[0] === tokenLine && tokenChar > r.end[1])) {
    return false;
  }

  return true;
}

function onSameLine(pos: Position, key: TemplateToken, value: TemplateToken): boolean {
  if (!value.range) {
    return false;
  }

  if (!key.range) {
    return false;
  }

  if (value.range.start[0] !== value.range.end[0]) {
    // Token occupies multiple lines, can't be an empty node
    return false;
  }

  // TokenRange is one-based, Position is zero-based
  const posLine = pos.line + 1;
  if (posLine != value.range.start[0]) {
    return false;
  }

  return true;
}

function emptyNode(token: TemplateToken | null): boolean {
  if (!token) {
    return false;
  }

  if (token.templateTokenType === TokenType.Null) {
    return true;
  }

  if (isString(token)) {
    return token.value === "";
  }

  return false;
}
