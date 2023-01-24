import {Position as TokenPosition, TokenRange} from "@github/actions-workflow-parser/templates/tokens/token-range";
import {Position, Range} from "vscode-languageserver-types";

export function mapRange(range: TokenRange | undefined): Range {
  if (!range) {
    return {
      start: {
        line: 1,
        character: 1
      },
      end: {
        line: 1,
        character: 1
      }
    };
  }

  return {
    start: mapPosition(range.start),
    end: mapPosition(range.end)
  };
}

export function mapPosition(position: TokenPosition): Position {
  return {
    line: position[0] - 1,
    character: position[1] - 1
  };
}
