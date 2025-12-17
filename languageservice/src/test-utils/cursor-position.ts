import {Position, TextDocument} from "vscode-languageserver-textdocument";
import {createDocument} from "./document.js";

/**
 * Calculates the position of the cursor and the document without that cursor
 * Cursor is represented by a `|` character
 * @param input Input string
 * @param skip Instances of `|` to skip
 */
export function getPositionFromCursor(input: string, skip = 0): [TextDocument, Position] {
  const doc = createDocument("test.yaml", input);

  let cursorIndex = doc.getText().indexOf("|");
  for (let i = 0; i < skip && cursorIndex !== -1; i++) {
    cursorIndex = doc.getText().indexOf("|", cursorIndex + 1);
  }

  if (cursorIndex === -1) {
    throw new Error("No cursor found in document");
  }

  // Replace only the last occurence of | in string
  let newText = doc.getText();
  newText = newText.substring(0, cursorIndex) + newText.substring(cursorIndex + 1);

  const position = doc.positionAt(cursorIndex);
  const newDoc = TextDocument.create(doc.uri, doc.languageId, doc.version, newText);

  return [newDoc, position];
}
