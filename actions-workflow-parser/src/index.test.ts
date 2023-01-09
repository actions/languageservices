import { TemplateValidationError } from "./templates/template-validation-error"
import { nullTrace } from "./test-utils/null-trace"
import { parseWorkflow } from "./workflows/workflow-parser"

describe("parseWorkflow", () => {
  it("parses valid workflow", () => {
    const result = parseWorkflow(
      "test.yaml",
      [
        {
          name: "test.yaml",
          content:
            "on: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n    - run: echo 'hello'",
        },
      ],
      nullTrace
    )

    expect(result.context.errors.getErrors()).toHaveLength(0)
  })

  it("contains range for error", () => {
    const result = parseWorkflow(
      "test.yaml",
      [
        {
          name: "test.yaml",
          content:
            "on: push\njobs:\n  build:\n    steps:\n    - run: echo 'hello'",
        },
      ],
      nullTrace
    )

    expect(result.context.errors.getErrors()).toEqual([
      new TemplateValidationError(
        "Required property is missing: runs-on",
        "test.yaml (Line: 4, Col: 5)",
        undefined,
        {
          start: [4, 5],
          end: [5, 24],
        }
      ),
    ])
  })

  it("error range for expression is constrained to scalar node", () => {
    const result = parseWorkflow(
      "test.yaml",
      [
        {
          name: "test.yaml",
          content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - name: \${{ github.event = 12 }}
      run: echo 'hello'`,
        },
      ],
      nullTrace
    )

    expect(result.context.errors.getErrors()).toEqual([
      new TemplateValidationError(
        "Unexpected symbol: '='. Located at position 14 within expression: github.event = 12",
        "test.yaml (Line: 6, Col: 13)",
        undefined,
        {
          start: [6, 13],
          end: [6, 37],
        }
      ),
    ])
  })

  it("tokens contain descriptions", () => {
    const result = parseWorkflow(
      "test.yaml",
      [
        {
          name: "test.yaml",
          content:
            "on: push\nname: hello\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n    - run: echo 'hello'",
        },
      ],
      nullTrace
    )

    expect(result.context.errors.getErrors()).toHaveLength(0)
    expect(result.value).not.toBeUndefined()
    const root = result.value!.assertMapping("root")
    expect(root.description).toBe("Workflow file with strict validation")
    for (const pair of root) {
      const key = pair.key.assertString("key").value
      switch (key) {
        case "name": {
          const nameKey = pair.key.assertString("name")
          expect(nameKey.definition).not.toBeUndefined()
          expect(nameKey.description).toBe("The name of the workflow.")
          break
        }
        case "on": {
          const onKey = pair.key.assertString("on")
          const onValue = pair.value.assertString("push")
          expect(onKey.definition).not.toBeUndefined()
          expect(onKey.description).toBe(
            "The name of the GitHub event that triggers the workflow. You can provide a single event string, array of events, array of event types, or an event configuration map that schedules a workflow or restricts the execution of a workflow to specific files, tags, or branch changes. For a list of available events, see https://help.github.com/en/github/automating-your-workflow-with-github-actions/events-that-trigger-workflows."
          )
          expect(onValue.definition).not.toBeUndefined()
          expect(onValue.description).toBe(
            "Runs your workflow when you push a commit or tag."
          )
          break
        }
      }
    }
  })
})
