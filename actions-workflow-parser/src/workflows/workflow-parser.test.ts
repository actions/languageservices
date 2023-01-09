import { parseWorkflow } from "./workflow-parser"
import { nullTrace } from "../test-utils/null-trace"

it("The template is not read when there are YAML errors", () => {
  const content = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: 'Hello \${{ fromJSON('test') == inputs.name }}'
        run: echo Hello, world!`

  const result = parseWorkflow(
    "main.yaml",
    [{ name: "main.yaml", content: content }],
    nullTrace
  )

  expect(result.context.errors.count).toBe(1)
  expect(result.value).toBeUndefined()
})
