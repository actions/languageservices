import * as fs from "fs"
import * as path from "path"
import * as YAML from "yaml"
import { convertWorkflowTemplate } from "./model/convert"
import { TraceWriter } from "./templates/trace-writer"
import { parseWorkflow } from "./workflows/workflow-parser"

interface TestOptions {
  "include-source"?: boolean
  skip?: string[]
}

const nullTrace: TraceWriter = {
  info: (x) => {},
  verbose: (x) => {},
  error: (x) => {},
}

const testFiles = "./testdata/reader"

describe("x-lang tests", () => {
  const files = fs.readdirSync(testFiles)

  for (const file of files) {
    const fileName = path.join(testFiles, file)

    const fileStat = fs.statSync(fileName)
    if (fileStat.isDirectory()) {
      throw new Error("sub-directories are not supported")
    }

    if (
      path.extname(fileName) !== ".yml" &&
      path.extname(fileName) !== ".yaml"
    ) {
      throw new Error("only y(a)ml files are supported " + file)
    }

    const inputFile = fs.readFileSync(fileName, "utf8")

    const testDocs: string[] = inputFile.split(/\r?\n---\r?\n/)
    expect(testDocs.length).toBeGreaterThanOrEqual(3)

    const testOptions: TestOptions = YAML.parse(testDocs[0])
    const unsupportedTest = contains(testOptions.skip, "TypeScript")

    const test = () => {
      let testFileName =
        ".github/workflows" + fileName.substring(fileName.lastIndexOf("/"))
      let testInput = testDocs[1]
      let expectedTemplate = testDocs[2].trim()
      // TODO: when reusable workflows are implemented, implement correctly
      if (fileName.indexOf("reusable") !== -1) {
        testFileName = testDocs[1]
        testInput = testDocs[2]
        expectedTemplate = testDocs[3].trim()
      }

      const parseResult = parseWorkflow(
        testFileName,
        [
          {
            name: testFileName,
            content: testInput,
          },
        ],
        nullTrace
      )

      expect(parseResult.value).not.toBeUndefined()

      const workflowTemplate = convertWorkflowTemplate(
        parseResult.context,
        parseResult.value!
      )

      // Unless this tests is only used by TypeScript, remove the events for now.
      // TODO: Remove this once we parse events everywhere
      const includeEvents =
        testOptions.skip !== undefined &&
        contains(testOptions.skip, "Go") &&
        contains(testOptions.skip, "C#")
      if (!includeEvents) {
        delete (workflowTemplate as any).events
      }

      // Other parsers don't have a partial template when there are errors
      if (workflowTemplate.errors) {
        delete (workflowTemplate as any).jobs
      }

      const result = JSON.stringify(workflowTemplate, null, "  ")
      expect(result).toBe(expectedTemplate)
    }

    if (unsupportedTest) {
      it.failing(fileName, test)
    } else {
      it(fileName, test)
    }
  }
})

// Case-insensitive contains
function contains(arr: string[] | undefined, term: string): boolean {
  if (!arr) {
    return false
  }
  return arr.map((x) => x.toLowerCase()).indexOf(term.toLowerCase()) !== -1
}
