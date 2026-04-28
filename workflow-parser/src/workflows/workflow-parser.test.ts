import {FeatureFlags} from "@actions/expressions";
import {TemplateContext, TemplateValidationErrors} from "../templates/template-context.js";
import {parseWorkflow} from "./workflow-parser.js";
import {getWorkflowSchema} from "./workflow-schema.js";
import {nullTrace} from "../test-utils/null-trace.js";

const ambiguousStep = `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - runn: echo hi`;

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

it("omits background step properties from ambiguity errors when disabled", () => {
  const result = parseWorkflow({name: "main.yaml", content: ambiguousStep}, nullTrace);

  expect(result.context.errors.getErrors().map(x => x.rawMessage)).toContain(
    "There's not enough info to determine what you meant. Add one of these properties: run, shell, uses, with, working-directory"
  );
});

it("includes background step properties in ambiguity errors when enabled", () => {
  const context = new TemplateContext(new TemplateValidationErrors(), getWorkflowSchema(), nullTrace);
  context.state.featureFlags = new FeatureFlags({allowBackgroundSteps: true});

  const result = parseWorkflow({name: "main.yaml", content: ambiguousStep}, context);

  expect(result.context.errors.getErrors().map(x => x.rawMessage)).toContain(
    "There's not enough info to determine what you meant. Add one of these properties: cancel, run, shell, uses, wait, wait-all, with, working-directory"
  );
});
