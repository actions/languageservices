import {Value} from "./config";
import {WorkflowTemplate} from "@github/actions-workflow-parser/model/workflow-template";

export function getJobNames(template: WorkflowTemplate | undefined): Value[] {
  if (!template) {
    return [];
  }

  const jobNames = new Set<string>();
  const jobList = template.jobs;
  for (const job of jobList) {
    const name = job.id;
    if (name && !jobNames.has(name)) {
      jobNames.add(name);
    }
  }

  return Array.from(jobNames).map(label => ({label}));
}
