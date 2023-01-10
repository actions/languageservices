import {IdBuilder} from "./id-builder";

function build(...segments: string[]): string {
  const builder = new IdBuilder();
  for (const segment of segments) {
    builder.appendSegment(segment);
  }
  return builder.build();
}

describe("ID Builder", () => {
  it("builds IDs", () => {
    expect(build("one")).toEqual("one");

    expect(build("one", "two")).toEqual("one_two");

    expect(build("one", "two", "three")).toEqual("one_two_three");
  });

  it("empty builder", () => {
    const builder = new IdBuilder();
    expect(builder.build()).toEqual("job");
  });

  it("ignores empty segments", () => {
    expect(build("", "one")).toEqual("one");

    expect(build("one", "", "two", "")).toEqual("one_two");
  });

  it("handles illegal characters", () => {
    const builder = new IdBuilder();
    builder.appendSegment("hello world!");
    expect(builder.build()).toEqual("hello_world_");
  });

  it("handles illegal leading characters", () => {
    expect(build("!hello")).toEqual("_hello");

    expect(build("!hello", "!world")).toEqual("_hello__world");

    expect(build("!@world", "!@world")).toEqual("__world___world");

    expect(build("123")).toEqual("_123");

    expect(build("123", "456")).toEqual("_123_456");

    expect(build("-abc")).toEqual("_-abc");

    expect(build("-abc", "-def")).toEqual("_-abc_-def");
  });

  it("allows legal characters", () => {
    expect(build("abyzABYZ0189_-")).toEqual("abyzABYZ0189_-");
  });

  it("allows legal leading characters", () => {
    expect(build("abc")).toEqual("abc");

    expect(build("bcd")).toEqual("bcd");

    expect(build("zyx")).toEqual("zyx");

    expect(build("yxw")).toEqual("yxw");

    expect(build("ABCD")).toEqual("ABCD");

    expect(build("BCDE")).toEqual("BCDE");

    expect(build("ZYXW")).toEqual("ZYXW");

    expect(build("YXWV")).toEqual("YXWV");

    expect(build("_abc")).toEqual("_abc");
  });

  it("errors for max collisions", () => {
    const builder = new IdBuilder();
    builder.appendSegment("abc");
    builder.appendSegment("def");
    expect(builder.build()).toEqual("abc_def");

    for (let i = 2; i < 1000; i++) {
      builder.appendSegment("abc");
      builder.appendSegment("def");
      expect(builder.build()).toEqual(`abc_def_${i}`);
    }

    builder.appendSegment("abc");
    builder.appendSegment("def");
    expect(() => builder.build()).toThrowError("Unable to create a unique name");
  });

  it("takes suffix into account for max length", () => {
    const builder = new IdBuilder();

    const name = "_234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890";
    builder.appendSegment(name);
    expect(builder.build()).toEqual(name);

    builder.appendSegment(name);
    expect(builder.build()).toEqual(
      "_2345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678_2"
    );

    builder.appendSegment(name);
    expect(builder.build()).toEqual(
      "_2345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678_3"
    );

    builder.appendSegment(name);
    expect(builder.build()).toEqual(
      "_2345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678_4"
    );

    builder.appendSegment(name);
    expect(builder.build()).toEqual(
      "_2345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678_5"
    );

    builder.appendSegment(name);
    expect(builder.build()).toEqual(
      "_2345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678_6"
    );

    builder.appendSegment(name);
    expect(builder.build()).toEqual(
      "_2345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678_7"
    );

    builder.appendSegment(name);
    expect(builder.build()).toEqual(
      "_2345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678_8"
    );

    builder.appendSegment(name);
    expect(builder.build()).toEqual(
      "_2345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678_9"
    );

    builder.appendSegment(name);
    expect(builder.build()).toEqual(
      "_234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567_10"
    );
  });
});
