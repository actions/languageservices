import {parseWorkflow} from "./workflow-parser.js";
import {nullTrace} from "../test-utils/null-trace.js";

it("The template is not read when there are YAML errors", () => {
  const content = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: 'Hello \${{ fromJSON('test') == inputs.name }}'
        run: echo Hello, world!`;

  const result = parseWorkflow({name: "main.yaml", content: content}, nullTrace);

  expect(result.context.errors.count).toBe(1);
  expect(result.value).toBeUndefined();
});
