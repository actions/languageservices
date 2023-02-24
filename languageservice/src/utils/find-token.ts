import {isString} from "@actions/workflow-parser";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/index";
import {MappingToken} from "@actions/workflow-parser/templates/tokens/mapping-token";
import {SequenceToken} from "@actions/workflow-parser/templates/tokens/sequence-token";
import {TokenType} from "@actions/workflow-parser/templates/tokens/types";
import {Position} from "vscode-languageserver-textdocument";

export function findInnerToken(pos: Position, root?: TemplateToken) {
  const {token} = findToken(pos, root);
  return token;
}

export type TokenResult = {
  parent: TemplateToken | null;
  keyToken: TemplateToken | null;
  token: TemplateToken | null;

  path: TemplateToken[];
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
      parent: null,
      path: []
    };
  }

  let lastMatching: TokenResult | null = null;

  const s: TokenResult[] = [
    {
      token: root,
      keyToken: null,
      parent: null,
      path: []
    }
  ];

  while (s.length > 0) {
    const result = s.shift()!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    const {parent, token, keyToken, path} = result;
    if (!token) {
      break;
    }

    if (!posInToken(pos, token)) {
      continue;
    }

    // Pos is in token, remember this token
    lastMatching = result;

    // Position is in token, enqueue children if there are any
    switch (token.templateTokenType) {
      case TokenType.Mapping: {
        const mappingToken = token as MappingToken;
        for (const {key, value} of mappingToken) {
          // If the position is within the key, immediately return it as the token.
          if (posInToken(pos, key)) {
            return {
              parent: mappingToken,
              keyToken: null,
              token: key,
              path: [...path, mappingToken]
            };
          }

          // If pos, key, and value are on the same line, and value is an empty node (null, empty string) return early
          // we cannot reliably check the position in that empty node
          if (onSameLine(pos, key, value) && emptyNode(value)) {
            return {
              parent: mappingToken,
              keyToken: key,
              token: value,
              path: [...path, mappingToken]
            };
          }

          s.push({
            parent: mappingToken,
            keyToken: key,
            token: value,
            path: [...path, mappingToken, key]
          });
        }
        continue;
      }
      case TokenType.Sequence: {
        const sequenceToken = token as SequenceToken;
        for (const token of sequenceToken) {
          s.push({
            parent: sequenceToken,
            keyToken: null,
            token: token,
            path: [...path, sequenceToken]
          });
        }
        continue;
      }
    }

    return {
      token,
      keyToken,
      parent,
      path
    };
  }

  // Did not find a matching token, return the last matching token as parent
  return {
    token: null,
    parent: lastMatching?.token ?? null,
    keyToken: null,
    path: lastMatching?.token ? [...lastMatching.path, lastMatching.token] : []
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
  if (r.start.line > tokenLine || tokenLine > r.end.line) {
    return false;
  }

  // Position is within the token lines. Check character/column if pos line matches
  // start or end
  if (
    (r.start.line === tokenLine && tokenChar < r.start.column) ||
    (r.end.line === tokenLine && tokenChar > r.end.column)
  ) {
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

  if (value.range.start.line !== value.range.end.line) {
    // Token occupies multiple lines, can't be an empty node
    return false;
  }

  // TokenRange is one-based, Position is zero-based
  const posLine = pos.line + 1;
  if (posLine != value.range.start.line) {
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
