import {isString} from "@github/actions-workflow-parser";
import {StringToken} from "@github/actions-workflow-parser/templates/tokens/string-token";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {Position, TextDocument} from "vscode-languageserver-textdocument";
import {Range} from "vscode-languageserver-types";

const PLACEHOLDER_KEY = "key";

// Transform a document to work around YAML parsing issues
// Based on `_transform` in https://github.com/cschleiden/github-actions-parser/blob/main/src/lib/parser/complete.ts#L311
export function transform(doc: TextDocument, pos: Position): [TextDocument, Position] {
  let offset = doc.offsetAt(pos);

  const lineRange: Range = {
    start: {line: pos.line, character: 0},
    end: {line: pos.line, character: Number.MAX_SAFE_INTEGER}
  };

  let line = doc.getText(lineRange);

  // If the line includes a new-line char, strip that out
  const newLinePos = line.indexOf("\n");
  if (newLinePos >= 0) {
    line = line.substring(0, newLinePos);
  }
  lineRange.end.character = line.length;

  const linePos = pos.character;

  // Special case for Actions, if this line contains an expression marker, do _not_ transform. This is
  // an ugly fix for auto-completion in multi-line YAML strings. At this point in the process, we cannot
  // determine if a line is in such a multi-line string.
  if (line.indexOf("${{") !== -1) {
    return [doc, pos];
  }

  const containsColon = line.indexOf(":") !== -1;
  if (!containsColon) {
    const trimmedLine = line.trim();
    if (trimmedLine === "" || trimmedLine === "-") {
      // Pos in sequence or empty line
      let spacer = "";
      if (trimmedLine === "-" && !line.endsWith(" ")) {
        spacer = " ";
        offset++;
      }

      line =
        line.substring(0, linePos) +
        spacer +
        PLACEHOLDER_KEY +
        (trimmedLine === "-" ? "" : ":") +
        line.substring(linePos);

      // Adjust pos by one to prevent a sequence node being marked as active
      offset++;
    } else if (!trimmedLine.startsWith("-")) {
      // Add `:` to end of line
      line = line + ":";
    }
  }

  const newDoc = TextDocument.create(doc.uri, doc.languageId, doc.version, doc.getText());

  TextDocument.update(
    newDoc,
    [
      {
        range: lineRange,
        text: line
      }
    ],
    newDoc.version + 1
  );

  return [newDoc, newDoc.positionAt(offset)];
}

// Detect placeholder key and value added by transform
export function isPlaceholder(key: StringToken, value: TemplateToken) {
  if (key.value === PLACEHOLDER_KEY && isString(value) && value.value == "") {
    return true;
  }

  return false;
}
