import { Dictionary } from "./dictionary";
import { StringData } from "./string";

describe("dictionary", () => {
  it("pairs contains all values", () => {
    const d = new Dictionary();
    d.add("ABC", new StringData("val"));

    expect(d.pairs()).toEqual([{ key: "ABC", value: new StringData("val") }]);
  });

  it("does not add duplicate entries", () => {
    const d = new Dictionary();
    d.add("ABC", new StringData("val1"));
    d.add("abc", new StringData("val2"));

    expect(d.pairs()).toEqual([{ key: "ABC", value: new StringData("val1") }]);
  });
});
