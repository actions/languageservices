import { Position, TextDocument } from "vscode-languageserver-textdocument";

const DUMMY_KEY = "dummy";

// Transform a document to work around YAML parsing issues
// Based on `_transform` in https://github.com/cschleiden/github-actions-parser/blob/main/src/lib/parser/complete.ts#L311
export function transform(
  doc: TextDocument,
  pos: Position
): [TextDocument, Position] {
  const input = doc.getText();
  let offset = doc.offsetAt(pos);
  // TODO: Optimize this...
  const lines = input.split("\n");
  const lineNo = input
    .substring(0, offset)
    .split("")
    .filter((x) => x === "\n").length;
  const linePos =
    offset - lines.slice(0, lineNo).reduce((p, l) => p + l.length + 1, 0);
  const line = lines[lineNo];

  let partialInput = line.trim();
  // Special case for Actions, if this line contains an expression marker, do _not_ transform. This is
  // an ugly fix for auto-completion in multi-line YAML strings. At this point in the process, we cannot
  // determine if a line is in such a multi-line string.
  if (partialInput.indexOf("${{") === -1) {
    const colon = line.indexOf(":");
    if (colon === -1) {
      const trimmedLine = line.trim();
      if (trimmedLine === "" || trimmedLine === "-") {
        // Node in sequence or empty line
        let spacer = "";
        if (trimmedLine === "-" && !line.endsWith(" ")) {
          spacer = " ";
          offset++;
        }

        lines[lineNo] =
          line.substring(0, linePos) +
          spacer +
          DUMMY_KEY +
          (trimmedLine === "-" ? "" : ":") +
          line.substring(linePos);

        // Adjust pos by one to prevent a sequence node being marked as active
        offset++;
      } else if (!trimmedLine.startsWith("-")) {
        // Add `:` to end of line
        lines[lineNo] = line + ":";
      }

      if (trimmedLine.startsWith("-")) {
        partialInput = trimmedLine
          .substring(trimmedLine.indexOf("-") + 1)
          .trim();
      }
    } else {
      partialInput = (
        offset > colon ? line.substring(colon + 1) : line.substring(0, colon)
      ).trim();
      offset = offset - 1;
    }
  }
  const newDoc = TextDocument.create(
    doc.uri,
    doc.languageId,
    doc.version,
    lines.join("\n")
  );
  return [newDoc, newDoc.positionAt(offset)];
}
