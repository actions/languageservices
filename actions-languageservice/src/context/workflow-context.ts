import {WorkflowTemplate} from "@github/actions-workflow-parser";
import {JobConfig, StepConfig} from "@github/actions-workflow-parser/model/workflow-template";
import {StringToken} from "@github/actions-workflow-parser/templates/tokens/string-token";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";

export interface WorkflowContext {
  uri: string;

  template: WorkflowTemplate | undefined;

  /** If the context is for a position within a job, this will be the job */
  job?: JobConfig;

  /** If the context is for a position within a step, this will the step */
  step?: StepConfig;
}

export function getWorkflowContext(
  uri: string,
  template: WorkflowTemplate | undefined,
  tokenPath: TemplateToken[]
): WorkflowContext {
  const context: WorkflowContext = {uri: uri, template};

  if (template) {
    // Iterate through the token path to find the job and step
    for (let i = 0; i < tokenPath.length; ++i) {
      const token = tokenPath[i];

      switch (token.definition?.key) {
        case "job-id": {
          const jobID = (token as StringToken).value;
          context.job = template.jobs.find(job => job.id === jobID);
        }
      }
    }
  }

  return context;
}
