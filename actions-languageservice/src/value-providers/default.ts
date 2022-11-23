import {Value, WorkflowContext} from "./config";
import {getJobNames} from "./needs";

export const defaultValueProviders: {[key: string]: (workflowContext: WorkflowContext) => Value[]} = {
  needs: (workflowContext: WorkflowContext) => getJobNames(workflowContext.template),
  "runs-on": () =>
    stringsToValues([
      "ubuntu-latest",
      "ubuntu-18.04",
      "ubuntu-16.04",
      "windows-latest",
      "windows-2019",
      "windows-2016",
      "macos-latest",
      "macos-10.15",
      "macos-10.14",
      "macos-10.13",
      "self-hosted"
    ])
};

export function stringsToValues(labels: string[]): Value[] {
  return labels.map(x => ({label: x}));
}
