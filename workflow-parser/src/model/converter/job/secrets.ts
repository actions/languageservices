import {TemplateContext} from "../../../templates/template-context";
import {NullToken} from "../../../templates/tokens";
import {ReusableWorkflowJob} from "../../workflow-template";
import {createTokenMap} from "./inputs";

export function convertWorkflowJobSecrets(context: TemplateContext, job: ReusableWorkflowJob) {
  // No validation if job passes all secrets
  if (job["inherit-secrets"]) {
    return;
  }

  const secretDefinitions = createTokenMap(
    job["secret-definitions"]?.assertMapping("workflow job secret definitions"),
    "secrets"
  );

  const secretValues = createTokenMap(job["secret-values"]?.assertMapping("workflow job secret values"), "secrets");

  if (secretDefinitions !== undefined) {
    for (const [, [name, value]] of secretDefinitions) {
      if (value instanceof NullToken) {
        continue;
      }

      const secretSpec = createTokenMap(value.assertMapping(`secret ${name}`), `secret ${name} key`);

      const required = secretSpec?.get("required")?.[1].assertBoolean(`secret ${name} required`).value;
      if (required) {
        if (secretValues == undefined || !secretValues.has(name.toLowerCase())) {
          context.error(job.ref, `Secret ${name} is required, but not provided while calling.`);
        }
      }
    }
  }

  if (secretValues !== undefined) {
    for (const [, [name, value]] of secretValues) {
      if (!secretDefinitions?.has(name.toLowerCase())) {
        context.error(value, `Invalid secret, ${name} is not defined in the referenced workflow.`);
      }
    }
  }
}
