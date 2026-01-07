import {validateFormatString} from "./validate-format.js";

describe("validateFormatString", () => {
  it("returns valid for simple placeholder", () => {
    const result = validateFormatString("{0}");
    expect(result).toEqual({valid: true, maxArgIndex: 0});
  });

  it("returns valid for multiple placeholders", () => {
    const result = validateFormatString("{0} {1} {2}");
    expect(result).toEqual({valid: true, maxArgIndex: 2});
  });

  it("returns valid for text with placeholder", () => {
    const result = validateFormatString("hello {0} world");
    expect(result).toEqual({valid: true, maxArgIndex: 0});
  });

  it("returns valid for escaped left braces", () => {
    const result = validateFormatString("{{0}} {0}");
    expect(result).toEqual({valid: true, maxArgIndex: 0});
  });

  it("returns valid for escaped right braces", () => {
    const result = validateFormatString("{0}}}");
    expect(result).toEqual({valid: true, maxArgIndex: 0});
  });

  it("returns valid for no placeholders", () => {
    const result = validateFormatString("hello world");
    expect(result).toEqual({valid: true, maxArgIndex: -1});
  });

  it("returns invalid for missing closing brace", () => {
    const result = validateFormatString("{0");
    expect(result).toEqual({valid: false, maxArgIndex: -1});
  });

  it("returns invalid for empty placeholder", () => {
    const result = validateFormatString("{}");
    expect(result).toEqual({valid: false, maxArgIndex: -1});
  });

  it("returns invalid for non-numeric placeholder", () => {
    const result = validateFormatString("{abc}");
    expect(result).toEqual({valid: false, maxArgIndex: -1});
  });

  it("returns invalid for unescaped closing brace", () => {
    const result = validateFormatString("text } more");
    expect(result).toEqual({valid: false, maxArgIndex: -1});
  });

  it("handles out-of-order placeholders", () => {
    const result = validateFormatString("{2} {0} {1}");
    expect(result).toEqual({valid: true, maxArgIndex: 2});
  });

  it("handles repeated placeholders", () => {
    const result = validateFormatString("{0} {0} {0}");
    expect(result).toEqual({valid: true, maxArgIndex: 0});
  });
});
