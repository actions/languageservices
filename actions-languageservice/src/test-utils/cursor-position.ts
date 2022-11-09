import { TextDocument, Position } from "vscode-languageserver-textdocument";

// Calculates the position of the cursor and the document without that cursor
// Cursor is represented by a `|` character
export function getPositionFromCursor(input: string): [TextDocument, Position] {
  const doc = TextDocument.create("test://test/test.yaml", "yaml", 0, input);

  const cursorIndex = doc.getText().indexOf("|");
  if (cursorIndex === -1) {
    throw new Error("No cursor found in document");
  }

  const position = doc.positionAt(cursorIndex);
  const newDoc = TextDocument.create(
    doc.uri,
    doc.languageId,
    doc.version,
    doc.getText().replace("|", "")
  );

  return [newDoc, position];
}
