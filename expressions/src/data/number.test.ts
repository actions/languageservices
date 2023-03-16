import {NumberData} from "./number";

describe("number", () => {
  it("coerces to string", () => {
    expect(new NumberData(-0).coerceString()).toEqual("0");
    expect(new NumberData(0).coerceString()).toEqual("0");
    expect(new NumberData(1).coerceString()).toEqual("1");
    expect(new NumberData(1.2).coerceString()).toEqual("1.2");

    // Round to 15 digits precision
    expect(new NumberData(1.2345678901234567).coerceString()).toEqual("1.234567890123457");
  });
});
