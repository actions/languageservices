import { Value } from "./config";
import { WorkflowTemplate } from "@github/actions-workflow-parser/model/workflow-template";

export async function getJobNames(
  template: WorkflowTemplate 
): Promise<Value[]> {
  const labels = new Set<string>([
    "dummy-job",
  ]);

  const jobsValues = template.jobs.jobNames;
  if (jobsValues) {
    for (const job of jobsValues?.values() || []) {
      labels.add(job);
    }
  }

  return Array.from(labels).map((label) => ({ label }));
}
