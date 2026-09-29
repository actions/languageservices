import {getPositionFromCursor} from "../test-utils/cursor-position.js";
import {transform} from "./transform.js";

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

  it("adds : at end of line with trailing comment", () => {
    const [doc, pos] = getPositionFromCursor("on: push\njobs:\n  build:\n    runs-on|\n#");
    const [newDoc, newPos] = transform(doc, pos);

    expect(newDoc.getText()).toEqual(`on: push
jobs:
  build:
    runs-on:
#`);
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
      - key`);
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
      key:`);
    expect(newPos.character).toEqual(7);
  });

  it("does not transform expression lines", () => {
    const [doc, pos] = getPositionFromCursor(`on: push
jobs:
  build:
    runs-on:
      \${{ github| }}`);
    const [newDoc, newPos] = transform(doc, pos);

    expect(newDoc.getText()).toEqual(`on: push
jobs:
  build:
    runs-on:
      \${{ github }}`);
    expect(newPos.character).toEqual(16);
  });
});
