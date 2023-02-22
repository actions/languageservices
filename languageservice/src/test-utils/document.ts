import {TextDocument} from "vscode-languageserver-textdocument";

export function createDocument(fileName: string, content: string): TextDocument {
  return TextDocument.create("test://test/" + fileName, "yaml", 0, content);
}
