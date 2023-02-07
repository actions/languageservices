import {TemplateContext} from "../../templates/template-context";
import {TemplateToken} from "../../templates/tokens";
import {TokenType} from "../../templates/tokens/types";
import {ReusableWorkflowJob} from "../workflow-template";
import {handleTemplateTokenErrors} from "./handle-errors";
import {convertWorkflowJobInputs} from "./job/inputs";
import {convertJobs} from "./jobs";

export function convertReferencedWorkflow(
  context: TemplateContext,
  referencedWorkflow: TemplateToken,
  job: ReusableWorkflowJob
) {
  const mapping = referencedWorkflow.assertMapping("root");

  // The language service doesn't currently handles on other documents,
  // So use the ref in the original workflow as the error location
  const tokenForErrors = job.ref;

  for (const pair of mapping) {
    const key = pair.key.assertString("root key");
    switch (key.value) {
      case "on": {
        handleTemplateTokenErrors(tokenForErrors, context, undefined, () =>
          convertReferencedWorkflowOn(context, pair.value, job)
        );
        break;
      }
      case "jobs": {
        job.jobs = handleTemplateTokenErrors(tokenForErrors, context, [], () => convertJobs(context, pair.value));
        break;
      }
    }
  }
}

function convertReferencedWorkflowOn(context: TemplateContext, on: TemplateToken, job: ReusableWorkflowJob) {
  const tokenForErrors = job.ref;
  switch (on.templateTokenType) {
    case TokenType.String: {
      const event = on.assertString("Reference workflow on value").value;
      if (event === "workflow_call") {
        handleTemplateTokenErrors(tokenForErrors, context, undefined, () => convertWorkflowJobInputs(context, job));
        return;
      }
      break;
    }

    case TokenType.Sequence: {
      const events = on.assertSequence("Reference workflow on value");
      for (const eventToken of events) {
        const event = eventToken.assertString(`Reference workflow on value ${eventToken}`).value;
        if (event === "workflow_call") {
          handleTemplateTokenErrors(tokenForErrors, context, undefined, () => convertWorkflowJobInputs(context, job));
          return;
        }
      }
      break;
    }

    case TokenType.Mapping: {
      const eventMapping = on.assertMapping("Reference workflow on value");

      for (const pair of eventMapping) {
        const event = pair.key.assertString(`Reference workflow on value ${pair.key}`).value;
        if (event !== "workflow_call") {
          continue;
        }

        if (pair.value.templateTokenType === TokenType.Null) {
          handleTemplateTokenErrors(tokenForErrors, context, undefined, () => convertWorkflowJobInputs(context, job));
          return;
        }

        const definitions = pair.value.assertMapping(`Reference workflow on value ${pair.key}`);
        for (const definition of definitions) {
          const definitionKey = definition.key.assertString(`on-workflow_call-${definition.key}`).value;
          switch (definitionKey) {
            case "inputs":
              job["input-definitions"] = definition.value.assertMapping(`on-workflow_call-${definition.key}`);
              break;

            case "outputs":
              job.outputs = definition.value.assertMapping(`on-workflow_call-${definition.key}`);
              break;
          }
        }

        handleTemplateTokenErrors(tokenForErrors, context, undefined, () => convertWorkflowJobInputs(context, job));
        return;
      }
      break;
    }
  }

  context.error(tokenForErrors, "workflow_call key is not defined in the referenced workflow.");
}
