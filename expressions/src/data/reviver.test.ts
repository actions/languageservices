import {Array} from "./array.js";
import {BooleanData} from "./boolean.js";
import {Dictionary} from "./dictionary.js";
import {ExpressionData} from "./expressiondata.js";
import {Null} from "./null.js";
import {NumberData} from "./number.js";
import {reviver} from "./reviver.js";
import {StringData} from "./string.js";

describe("reviver", () => {
  const tests: {
    name: string;
    data: string;
    want: ExpressionData;
  }[] = [
    {
      name: "null",
      data: "null",
      want: new Null()
    },
    {
      name: "number",
      data: "1",
      want: new NumberData(1)
    },
    {
      name: "string",
      data: `"a"`,
      want: new StringData("a")
    },
    {
      name: "true boolean",
      data: "true",
      want: new BooleanData(true)
    },
    {
      name: "false boolean",
      data: "false",
      want: new BooleanData(false)
    },
    {
      name: "array",
      data: `[1,2,3]`,
      want: new Array(new NumberData(1), new NumberData(2), new NumberData(3))
    },
    {
      name: "nested array",
      data: `[1,2,[3,4],5]`,
      want: new Array(
        new NumberData(1),
        new NumberData(2),
        new Array(new NumberData(3), new NumberData(4)),
        new NumberData(5)
      )
    },
    {
      name: "complex array",
      data: `[{"a":[true,2]},{"b":"three"},{"c":null}]`,
      want: new Array(
        new Dictionary({
          key: "a",
          value: new Array(new BooleanData(true), new NumberData(2))
        }),
        new Dictionary({key: "b", value: new StringData("three")}),
        new Dictionary({key: "c", value: new Null()})
      )
    },
    {
      name: "dictionary",
      data: `{ "object1": {} }`,
      want: new Dictionary({
        key: "object1",
        value: new Dictionary()
      })
    }
  ];

  test.each(tests)("$name", ({data, want}: {data: string; want: ExpressionData}) => {
    expect(JSON.parse(data, reviver)).toEqual(want);
  });
});
