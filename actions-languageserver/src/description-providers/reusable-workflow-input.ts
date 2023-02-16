import {WorkflowTemplate} from "@github/actions-workflow-parser";
import {isReusableWorkflowJob} from "@github/actions-workflow-parser/model/type-guards";
import {ReusableWorkflowJob} from "@github/actions-workflow-parser/model/workflow-template";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";

export async function getReusableWorkflowInputDescription(
  reusableWorkflowJob: ReusableWorkflowJob,
  token: TemplateToken,
  template: WorkflowTemplate
): Promise<string | undefined> {
  if (!isReusableWorkflowJob(reusableWorkflowJob)) {
    return undefined;
  }

  // Filter out just reusable jobs
  const templateReusableJobs = template.jobs.filter(isReusableWorkflowJob);

  // Find the reusable job in the template that matches the current reusable job
  const templateReusableJob = templateReusableJobs.find(job => job.id.value === reusableWorkflowJob.id.value);
  
  // Set the description on the reusable job to the one from the template, if any
  if (templateReusableJob && reusableWorkflowJob["input-definitions"] && templateReusableJob["input-definitions"]) {
    // For each input in the reusable job, see if there's one that matches in the template
    for (const input of reusableWorkflowJob["input-definitions"]) {
      const templateInput = templateReusableJob["input-definitions"].find(templateInput => templateInput.key.value === input.key.value);
      if (templateInput) {
        return "fuck me"
      }
    }

  }



  return "Didn't find a matching job description!"
}
