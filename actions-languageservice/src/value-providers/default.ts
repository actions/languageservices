import {WorkflowContext} from "../context/workflow-context";
import {ValueProviderConfig, ValueProviderKind} from "./config";
import {needs} from "./needs";
import {stringsToValues} from "./strings-to-values";

export const defaultValueProviders: ValueProviderConfig = {
  needs: {
    kind: ValueProviderKind.AllowedValues,
    get: needs
  },
  "runs-on": {
    kind: ValueProviderKind.SuggestedValues,
    get: async (_: WorkflowContext) =>
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
  }
};
