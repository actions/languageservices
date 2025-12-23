import {Array} from "./array.js";
import {Dictionary} from "./dictionary.js";
import {Null} from "./null.js";
import {NumberData} from "./number.js";
import {replacer} from "./replacer.js";
import {StringData} from "./string.js";

describe("replacer", () => {
  it("null", () => {
    expect(JSON.stringify(new Null(), replacer, "  ")).toEqual("null");
  });

  it("array", () => {
    expect(JSON.stringify(new Array(new StringData("a"), new StringData("b")), replacer, "  ")).toEqual(
      '[\n  "a",\n  "b"\n]'
    );
  });

  it("dictionary", () => {
    expect(JSON.stringify(new Dictionary({key: "a", value: new NumberData(42)}), replacer, "  ")).toEqual(
      '{\n  "a": 42\n}'
    );
  });
});
