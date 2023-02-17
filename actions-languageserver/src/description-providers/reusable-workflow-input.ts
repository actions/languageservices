import {WorkflowTemplate, isMapping} from "@github/actions-workflow-parser";
import {isReusableWorkflowJob} from "@github/actions-workflow-parser/model/type-guards";
import {isString} from "@github/actions-workflow-parser";
import {ReusableWorkflowJob} from "@github/actions-workflow-parser/model/workflow-template";
import {DESCRIPTION} from "@github/actions-workflow-parser/templates/template-constants";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";

export async function getReusableWorkflowInputDescription(
  reusableWorkflowJob: ReusableWorkflowJob,
  token: TemplateToken,
  template: WorkflowTemplate
): Promise<string | undefined> {
  if (!isReusableWorkflowJob(reusableWorkflowJob)) {
    return undefined;
  }

  const inputName = isString(token) && token.value;
  if (!inputName) {
    return undefined;
  }

  // Filter out just reusable jobs
  const templateReusableJobs = template.jobs.filter(isReusableWorkflowJob);

  // Find the reusable job in the template that matches the current reusable job
  const templateReusableJob = templateReusableJobs.find(job => job.id.value === reusableWorkflowJob.id.value);
  
  // Find the input description in the template, if any
  if (templateReusableJob && reusableWorkflowJob["input-definitions"] && templateReusableJob["input-definitions"]) {
    const definition = templateReusableJob["input-definitions"].find(token.value)
    if (definition && isMapping(definition)) {
      const description = definition.find(DESCRIPTION)
      if (description && isString(description)) {
        return description.value
      }
    }
  }

  return ""
}
