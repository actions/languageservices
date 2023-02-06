import * as fs from "fs";
import * as path from "path";
import * as YAML from "yaml";
import {convertWorkflowTemplate} from "./model/convert";
import {TraceWriter} from "./templates/trace-writer";
import {File} from "./workflows/file";
import {FileProvider} from "./workflows/file-provider";
import {parseWorkflow} from "./workflows/workflow-parser";

interface TestOptions {
  "include-source"?: boolean;
  skip?: string[];
}

const nullTrace: TraceWriter = {
  info: x => {},
  verbose: x => {},
  error: x => {}
};

const testFiles = "./testdata/reader";

describe("x-lang tests", () => {
  const files = fs.readdirSync(testFiles);

  for (const file of files) {
    const fileName = path.join(testFiles, file);

    const fileStat = fs.statSync(fileName);
    if (fileStat.isDirectory()) {
      throw new Error("sub-directories are not supported");
    }

    if (path.extname(fileName) !== ".yml" && path.extname(fileName) !== ".yaml") {
      throw new Error("only y(a)ml files are supported " + file);
    }

    const inputFile = fs.readFileSync(fileName, "utf8");

    const testDocs: string[] = inputFile.split(/\r?\n---\r?\n/);
    expect(testDocs.length).toBeGreaterThanOrEqual(3);

    const testOptions: TestOptions = YAML.parse(testDocs[0]);
    const unsupportedTest = contains(testOptions.skip, "TypeScript");

    const test = async () => {
      const testFileName = ".github/workflows" + fileName.substring(fileName.lastIndexOf("/"));
      const testInput = testDocs[1];
      const expectedTemplate = testDocs[testDocs.length - 1].trim();

      // For reusable workflow tests, additional workflows are passed in as pairs of
      // file names and file contents
      const reusableWorkflows: Record<string, File> = {};
      if (fileName.indexOf("reusable") !== -1) {
        for (let i = 2; i < testDocs.length - 1; i = i + 2) {
          reusableWorkflows[testDocs[i]] = {
            name: testDocs[i],
            content: testDocs[i + 1]
          };
        }
      }

      const testFileProvider: FileProvider = {
        getFileContent: async (fileName: string) => {
          const file = reusableWorkflows[fileName];
          if (file) {
            return file;
          }

          throw new Error("File not found: " + fileName);
        }
      };

      const parseResult = parseWorkflow(
        {
          name: testFileName,
          content: testInput
        },
        nullTrace
      );

      expect(parseResult.value).not.toBeUndefined();

      const workflowTemplate = await convertWorkflowTemplate(
        parseResult.context,
        parseResult.value!,
        undefined,
        testFileProvider,
        {
          fetchReusableWorkflowDepth: 1
        }
      );

      // Unless this tests is only used by TypeScript, remove the events for now.
      // TODO: Remove this once we parse events everywhere
      const includeEvents =
        testOptions.skip !== undefined && contains(testOptions.skip, "Go") && contains(testOptions.skip, "C#");
      if (!includeEvents) {
        delete (workflowTemplate as any).events;
      }

      // Other parsers don't have a partial template when there are errors
      if (workflowTemplate.errors) {
        delete (workflowTemplate as any).jobs;
      }

      const result = JSON.stringify(workflowTemplate, null, "  ");
      expect(result).toBe(expectedTemplate);
    };

    if (unsupportedTest) {
      it.failing(fileName, test);
    } else {
      it(fileName, test);
    }
  }
});

// Case-insensitive contains
function contains(arr: string[] | undefined, term: string): boolean {
  if (!arr) {
    return false;
  }
  return arr.map(x => x.toLowerCase()).indexOf(term.toLowerCase()) !== -1;
}
