import { validate } from "@github/actions-languageservice";
import { TextDocument } from "vscode-languageserver-textdocument";

describe("simple test", () => {
  it("should work", async () => {
    const doc = TextDocument.create("uri", "workflow", 1, "on: push");

    const r = await validate(doc);
    expect(r).not.toBeNull();
  });
});
