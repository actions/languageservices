import {
  TemplateToken,
  MAPPING_TYPE,
  SEQUENCE_TYPE,
  NULL_TYPE
} from "@github/actions-workflow-parser/templates/tokens/index";
import {MappingToken} from "@github/actions-workflow-parser/templates/tokens/mapping-token";
import {SequenceToken} from "@github/actions-workflow-parser/templates/tokens/sequence-token";
import {Position} from "vscode-languageserver-textdocument";

export function findInnerToken(pos: Position, root?: TemplateToken) {
  const [innerToken, _] = findInnerTokenAndParent(pos, root);
  return innerToken;
}

export function findInnerTokenAndParent(
  pos: Position,
  root?: TemplateToken
): [TemplateToken | null, TemplateToken | null] {
  if (!root) {
    return [null, null];
  }

  const s = [root];

  let parent: TemplateToken | null = null;

  for (;;) {
    const token = s.shift();
    if (!token) {
      break;
    }

    if (!posInToken(pos, token)) {
      continue;
    }

    // Position is in token, enqueue children if there are any
    switch (token.templateTokenType) {
      case MAPPING_TYPE:
        const mappingToken = token as MappingToken;
        parent = mappingToken;
        for (let i = 0; i < mappingToken.count; i++) {
          const {key, value} = mappingToken.get(i);

          // Null tokens don't have a position, we can only use the line information
          if (nullNodeOnLine(pos, key, value)) {
            return [value, key];
          }

          s.push(value);
        }
        continue;

      case SEQUENCE_TYPE:
        const sequenceToken = token as SequenceToken;
        parent = sequenceToken;
        for (let i = 0; i < sequenceToken.count; i++) {
          s.push(sequenceToken.get(i));
        }
        continue;
    }

    return [token, parent];
  }

  return [null, parent];
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

function nullNodeOnLine(pos: Position, key: TemplateToken, value: TemplateToken): boolean {
  if (value.templateTokenType !== NULL_TYPE) {
    return false;
  }

  if (!value.range) {
    return false;
  }

  if (!key.range) {
    return false;
  }

  if (value.range.start[0] !== value.range.end[0]) {
    // Token occupies multiple lines, can't be a null node
    return false;
  }

  // TokenRange is one-based, Position is zero-based
  const posLine = pos.line + 1;
  if (posLine != value.range.start[0]) {
    return false;
  }

  return true;
}
