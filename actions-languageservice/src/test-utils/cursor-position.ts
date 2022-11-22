import {Position, TextDocument} from "vscode-languageserver-textdocument";
import {createDocument} from "./document";

// Calculates the position of the cursor and the document without that cursor
// Cursor is represented by a `|` character
export function getPositionFromCursor(input: string): [TextDocument, Position] {
  const doc = createDocument("test.yaml", input);

  const cursorIndex = doc.getText().indexOf("|");
  if (cursorIndex === -1) {
    throw new Error("No cursor found in document");
  }

  const position = doc.positionAt(cursorIndex);
  const newDoc = TextDocument.create(doc.uri, doc.languageId, doc.version, doc.getText().replace("|", ""));

  return [newDoc, position];
}
