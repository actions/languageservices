import {TokenRange} from "@github/actions-workflow-parser/templates/tokens/token-range";
import {Range} from "vscode-languageserver-types";

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
    start: {
      line: range.start[0] - 1,
      character: range.start[1] - 1
    },
    end: {
      line: range.end[0] - 1,
      character: range.end[1] - 1
    }
  };
}
