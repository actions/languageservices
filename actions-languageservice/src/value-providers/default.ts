import {WorkflowContext} from "../context/workflow-context";
import {Value, ValueProviderConfig} from "./config";
import {needs} from "./needs";

export const defaultValueProviders: ValueProviderConfig = {
  needs,
  "runs-on": async (_: WorkflowContext) =>
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
