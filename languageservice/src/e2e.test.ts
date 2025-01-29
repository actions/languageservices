import {complete} from "./complete";
import {hover} from "./hover";
import {registerLogger} from "./log";
import {getPositionFromCursor} from "./test-utils/cursor-position";
import {TestLogger} from "./test-utils/logger";
import {clearCache} from "./utils/workflow-cache";

registerLogger(new TestLogger());

beforeEach(() => {
  clearCache();
});

describe("end-to-end", () => {
  it("empty workflow completion after hover", async () => {
    const input = "|";

    // Issue hover first to fill the cache
    await hover(...getPositionFromCursor(input));

    const result = await complete(...getPositionFromCursor(input));

    expect(result).not.toBeUndefined();
    expect(result.length).toEqual(9);
    const labels = result.map(x => x.label);
    expect(labels).toEqual([
      "concurrency",
      "defaults",
      "description",
      "env",
      "jobs",
      "name",
      "on",
      "permissions",
      "run-name"
    ]);
  });
});
