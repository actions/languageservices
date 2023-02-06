import {TemplateContext} from "../../../templates/template-context";
import {MappingToken, TemplateToken} from "../../../templates/tokens";
import {ReusableWorkflowJob} from "../../workflow-template";

type TokenMap = Map<string, [key: string, value: TemplateToken]>;

export function convertWorkflowJobInputs(context: TemplateContext, job: ReusableWorkflowJob) {
  const inputDefinitions = createTokenMap(
    job["input-definitions"]?.assertMapping("workflow job input definitions"),
    "inputs"
  );

  const inputValues = createTokenMap(job["input-values"]?.assertMapping("workflow job input values"), "with");

  if (inputDefinitions !== undefined) {
    for (const [_, [name, value]] of inputDefinitions) {
      const inputSpec = createTokenMap(value.assertMapping(`input ${name}`), `input ${name} key`)!;

      const inputTypeToken = inputSpec.get("type")?.[1];
      if (!inputTypeToken) {
        // This should be validated by the template reader per the schema
        continue;
      }

      const inputSet = inputValues !== undefined && inputValues.has(name.toLowerCase());
      const required = inputSpec.get("required")?.[1].assertBoolean(`input ${name} required`).value;
      if (required && !inputSet) {
        context.error(job.ref, `Input ${name} is required, but not provided while calling.`);
      }
    }
  }

  if (inputValues !== undefined) {
    for (const [_, [name, value]] of inputValues) {
      if (inputDefinitions !== undefined && !inputDefinitions.has(name.toLowerCase())) {
        context.error(value, `Invalid input, ${name} is not defined in the referenced workflow.`);
      }
    }
  }
}

function createTokenMap(mapping: MappingToken | undefined, description: string): TokenMap | undefined {
  if (!mapping) {
    return undefined;
  }

  const result = new Map<string, [key: string, value: TemplateToken]>();
  for (const item of mapping) {
    const name = item.key.assertString(`${description} key`);
    result.set(name.value.toLowerCase(), [name.value, item.value]);
  }

  return result;
}
