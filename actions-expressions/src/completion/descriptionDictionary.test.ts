import {StringData} from "../data";
import {DescriptionDictionary} from "./descriptionDictionary";

describe("description dictionary", () => {
  it("pairs contains all values", () => {
    const d = new DescriptionDictionary();
    d.add("ABC", new StringData("val"));

    expect(d.pairs()).toEqual([{key: "ABC", value: new StringData("val")}]);
  });

  it("does not add duplicate entries", () => {
    const d = new DescriptionDictionary();
    d.add("ABC", new StringData("val1"));
    d.add("abc", new StringData("val2"));

    expect(d.pairs()).toEqual([{key: "ABC", value: new StringData("val1")}]);
  });

  it("can set optional descriptions", () => {
    const d = new DescriptionDictionary();
    d.add("ABC", new StringData("val"), "desc");
    d.add("DEF", new StringData("val"));

    expect(d.pairs()).toEqual([
      {key: "ABC", value: new StringData("val"), description: "desc"},
      {key: "DEF", value: new StringData("val")}
    ]);
  });
});
