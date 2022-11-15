import {getPositionFromCursor} from "./cursor-position";

describe("getPositionFromCursor", () => {
  it("returns the position of the cursor and the document without that cursor", () => {
    const input = "on: push\njobs:|";
    const [newDoc, position] = getPositionFromCursor(input);

    expect(position).toEqual({line: 1, character: 5});
    expect(newDoc.getText()).toEqual("on: push\njobs:");
  });

  it("throws an error if no cursor is found", () => {
    const input = "on: push\njobs:";
    expect(() => getPositionFromCursor(input)).toThrowError("No cursor found in document");
  });

  it("handles a cursor at the beginning of the document", () => {
    const input = "|on: push\njobs:";
    const [newDoc, position] = getPositionFromCursor(input);

    expect(position).toEqual({line: 0, character: 0});
    expect(newDoc.getText()).toEqual("on: push\njobs:");
  });
});
