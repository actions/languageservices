import {getPositionFromCursor} from "../test-utils/cursor-position";
import {transform} from "./transform";

describe("transform", () => {
  it("adds : at end of line", () => {
    const [doc, pos] = getPositionFromCursor("on: push\njobs:\n  build:\n    runs-on|");
    const [newDoc, newPos] = transform(doc, pos);

    expect(newDoc.getText()).toEqual(`on: push
jobs:
  build:
    runs-on:`);
    expect(newPos.character).toEqual(11);
  });

  it("adds placeholder node in empty sequence", () => {
    const [doc, pos] = getPositionFromCursor(`on: push
jobs:
  build:
    runs-on:
      - |`);
    const [newDoc, newPos] = transform(doc, pos);

    expect(newDoc.getText()).toEqual(`on: push
jobs:
  build:
    runs-on:
      - dummy`);
    expect(newPos.character).toEqual(9);
  });

  it("adds placeholder node in empty line", () => {
    const [doc, pos] = getPositionFromCursor(`on: push
jobs:
  build:
    runs-on:
      |`);
    const [newDoc, newPos] = transform(doc, pos);

    expect(newDoc.getText()).toEqual(`on: push
jobs:
  build:
    runs-on:
      dummy:`);
    expect(newPos.character).toEqual(7);
  });
});
