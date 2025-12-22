import {Null, NumberData, StringData} from "../data/index.js";
import {format} from "./format.js";

describe("format", () => {
  it("null", () => {
    expect(format.call(new StringData("{0}"), new Null())).toEqual(new StringData(""));
  });
  it("number", () => {
    expect(format.call(new StringData("{0}"), new NumberData(42))).toEqual(new StringData("42"));
  });
});
