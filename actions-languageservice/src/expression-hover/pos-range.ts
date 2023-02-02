import {Pos, Range} from "@github/actions-expressions/lexer";

export function posWithinRange(pos: Pos, range: Range): boolean {
  return (
    pos.line >= range.start.line &&
    pos.line <= range.end.line &&
    pos.column >= range.start.column &&
    pos.column <= range.end.column
  );
}
