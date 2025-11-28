import * as path from "path";
import {fileURLToPath} from "url";
import {loadTestCases, runTestCase} from "./runner";
import {ValidationConfig} from "../../validate";
import {ActionMetadata, ActionReference} from "../../action";
import {clearCache} from "../../utils/workflow-cache";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock action metadata provider for tests
const validationConfig: ValidationConfig = {
  actionsMetadataProvider: {
    fetchActionMetadata: (ref: ActionReference): Promise<ActionMetadata | undefined> => {
      const key = `${ref.owner}/${ref.name}@${ref.ref}`;

      const metadata: Record<string, ActionMetadata> = {
        "actions/cache@v1": {
          name: "Cache",
          description: "Cache dependencies",
          inputs: {
            path: {
              description: "A list of files to cache",
              required: true
            },
            key: {
              description: "Cache key",
              required: true
            },
            "restore-keys": {
              description: "Restore keys",
              required: false
            }
          }
        },
        "actions/setup-node@v3": {
          name: "Setup Node",
          description: "Setup Node. js",
          inputs: {
            "node-version": {
              description: "Node version",
              required: true,
              default: "16"
            }
          }
        }
      };

      return Promise.resolve(metadata[key]);
    }
  }
};

// Point to the source testdata directory
const testdataDir = path.join(__dirname, "testdata");

beforeEach(() => {
  clearCache();
});

describe("code action golden tests", () => {
  const testCases = loadTestCases(testdataDir);

  if (testCases.length === 0) {
    it.todo("no test cases found - add . yml files to testdata/");
    return;
  }

  for (const testCase of testCases) {
    it(testCase.name, async () => {
      const result = await runTestCase(testCase, validationConfig);

      if (!result.passed) {
        let errorMessage = result.error || "Test failed";

        if (result.expected !== undefined && result.actual !== undefined) {
          errorMessage += "\n\n";
          errorMessage += "=== EXPECTED (golden file) ===\n";
          errorMessage += result.expected;
          errorMessage += "\n\n";
          errorMessage += "=== ACTUAL ===\n";
          errorMessage += result.actual;
        }

        throw new Error(errorMessage);
      }
    });
  }
});
