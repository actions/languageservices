import {complete} from "./complete.js";
import {hover} from "./hover.js";
import {registerLogger} from "./log.js";
import {getPositionFromCursor} from "./test-utils/cursor-position.js";
import {TestLogger} from "./test-utils/logger.js";
import {clearCache} from "./utils/workflow-cache.js";

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
    expect(result.length).toEqual(13);
    const labels = result.map(x => x.label);
    expect(labels).toEqual([
      "concurrency",
      "concurrency (full syntax)",
      "defaults",
      "description",
      "env",
      "jobs",
      "name",
      "on",
      "on (full syntax)",
      "on (list)",
      "permissions",
      "permissions (full syntax)",
      "run-name"
    ]);
  });
});
