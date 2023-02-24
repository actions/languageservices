import {TokenRange} from "@actions/workflow-parser/templates/tokens/token-range";
import {Position} from "vscode-languageserver-textdocument";
import {mapRange} from "./range";

export function getRelCharOffset(tokenRange: TokenRange, currentInput: string, pos: Position): number {
  const range = mapRange(tokenRange);
  if (range.start.line !== range.end.line) {
    const lines = currentInput.split("\n");
    const lineDiff = pos.line - range.start.line - 1;
    const linesBeforeCusor = lines.slice(0, lineDiff);
    return linesBeforeCusor.join("\n").length + pos.character + 1;
  } else {
    return pos.character - range.start.character;
  }
}
