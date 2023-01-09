import { BooleanData, ExpressionData, NumberData, StringData } from "./data";
import { coerceTypes, toUpperSpecial } from "./result";

describe("coerceTypes", () => {
  const tests: {
    name: string;
    data: {
      l: ExpressionData;
      r: ExpressionData;
    };
    wantL: ExpressionData;
    wantR: ExpressionData;
  }[] = [
    {
      name: "number-bool",
      data: { l: new NumberData(1), r: new BooleanData(true) },
      wantL: new NumberData(1),
      wantR: new NumberData(1),
    },
    {
      name: "number-bool-false",
      data: { l: new NumberData(1), r: new BooleanData(false) },
      wantL: new NumberData(1),
      wantR: new NumberData(0),
    },
    {
      name: "bool-number-false",
      data: { l: new BooleanData(false), r: new NumberData(1) },
      wantL: new NumberData(0),
      wantR: new NumberData(1),
    },
    {
      name: "number-number",
      data: { l: new NumberData(1), r: new NumberData(2) },
      wantL: new NumberData(1),
      wantR: new NumberData(2),
    },
    {
      name: "string-string",
      data: { l: new StringData("a"), r: new StringData("b") },
      wantL: new StringData("a"),
      wantR: new StringData("b"),
    },
    {
      name: "string-number",
      data: { l: new StringData("a"), r: new NumberData(1) },
      wantL: new NumberData(NaN),
      wantR: new NumberData(1),
    },
    {
      name: "number-string",
      data: { l: new NumberData(1), r: new StringData("a") },
      wantL: new NumberData(1),
      wantR: new NumberData(NaN),
    },
    {
      name: "bool-bool",
      data: { l: new BooleanData(false), r: new BooleanData(true) },
      wantL: new BooleanData(false),
      wantR: new BooleanData(true),
    },
  ];

  test.each(tests)(
    "$name",
    ({
      data,
      wantL,
      wantR,
    }: {
      data: { l: ExpressionData; r: ExpressionData };
      wantL: ExpressionData;
      wantR: ExpressionData;
    }) => {
      const [gotL, gotR] = coerceTypes(data.l, data.r);
      expect(gotL).toEqual(wantL);
      expect(gotR).toEqual(wantR);
    }
  );
});

describe("toUpperSpecial", () => {
  const tests: { input: string; want: string }[] = [
    { input: "", want: "" },
    { input: "abc", want: "ABC" },
    { input: "ıabc", want: "ıABC" },
    { input: "ııabc", want: "ııABC" },
    { input: "abcı", want: "ABCı" },
    { input: "abcıı", want: "ABCıı" },
    { input: "abcıdef", want: "ABCıDEF" },
    { input: "abcııdef", want: "ABCııDEF" },
    { input: "abcıdefıghi", want: "ABCıDEFıGHI" },
  ];

  test.each(tests)(
    "$input",
    ({ input, want }: { input: string; want: string }) => {
      expect(toUpperSpecial(input)).toEqual(want);
    }
  );
});
