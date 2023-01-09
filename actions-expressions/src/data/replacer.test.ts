import { Array } from "./array";
import { Dictionary } from "./dictionary";
import { Null } from "./null";
import { NumberData } from "./number";
import { replacer } from "./replacer";
import { StringData } from "./string";

describe("replacer", () => {
  it("null", () => {
    expect(JSON.stringify(new Null(), replacer, "  ")).toEqual("null");
  });

  it("array", () => {
    expect(
      JSON.stringify(
        new Array(new StringData("a"), new StringData("b")),
        replacer,
        "  "
      )
    ).toEqual('[\n  "a",\n  "b"\n]');
  });

  it("dictionary", () => {
    expect(
      JSON.stringify(
        new Dictionary({ key: "a", value: new NumberData(42) }),
        replacer,
        "  "
      )
    ).toEqual('{\n  "a": 42\n}');
  });
});
