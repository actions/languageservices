import {data} from "@github/actions-expressions/.";
import {complete, getExpressionInput} from "./complete";
import {ContextProviderConfig} from "./context-providers/config";
import {getPositionFromCursor} from "./test-utils/cursor-position";

const contextProviderConfig: ContextProviderConfig = {
  async getContext(contexts: string[]): Promise<data.Dictionary | undefined> {
    const context = new data.Dictionary();

    for (const contextName of contexts) {
      switch (contextName) {
        case "github":
          context.add(
            "github",
            new data.Dictionary({
              key: "event",
              value: new data.StringData("push")
            })
          );
          break;

        default:
          context.add(contextName, new data.Dictionary());
          break;
      }
    }

    return context;
  }
};

describe("expressions", () => {
  it("input extraction", () => {
    const test = (input: string) => {
      const [doc, pos] = getPositionFromCursor(input);
      return getExpressionInput(doc.getText(), pos.character);
    };

    expect(test("${{ gh |")).toBe(" gh ");
    expect(test("${{ gh |}}")).toBe(" gh ");
    expect(test("${{ vars }} ${{ gh |}}")).toBe(" gh ");
  });

  describe("top-level auto-complete", () => {
    it("single region", async () => {
      const input = "run-name: ${{ | }}";
      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

      expect(result.map(x => x.label)).toEqual([
        "github",
        "inputs",
        "vars",
        "contains",
        "endsWith",
        "format",
        "fromJson",
        "join",
        "startsWith",
        "toJson"
      ]);
    });

    it("single region with existing input", async () => {
      const input = "run-name: ${{ g| }}";
      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

      expect(result.map(x => x.label)).toEqual([
        "github",
        "inputs",
        "vars",
        "contains",
        "endsWith",
        "format",
        "fromJson",
        "join",
        "startsWith",
        "toJson"
      ]);
    });

    it("multiple regions", async () => {
      const input = "run-name: test-${{ github }}-${{ | }}";
      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

      expect(result.map(x => x.label)).toEqual([
        "github",
        "inputs",
        "vars",
        "contains",
        "endsWith",
        "format",
        "fromJson",
        "join",
        "startsWith",
        "toJson"
      ]);
    });

    it("nested auto-complete", async () => {
      const input = "run-name: ${{ github.| }}";
      const result = await complete(...getPositionFromCursor(input), undefined, contextProviderConfig);

      expect(result.map(x => x.label)).toEqual(["event"]);
    });
  });
});
