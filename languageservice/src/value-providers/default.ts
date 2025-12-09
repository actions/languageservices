import {ValueProviderConfig, ValueProviderKind} from "./config";
import {needs} from "./needs";
import {reusableJobInputs} from "./reusable-job-inputs";
import {reusableJobSecrets} from "./reusable-job-secrets";
import {stringsToValues} from "./strings-to-values";

export const DEFAULT_RUNNER_LABELS = [
  "ubuntu-latest",
  "ubuntu-24.04",
  "ubuntu-22.04",
  "ubuntu-24.04-arm",
  "ubuntu-22.04-arm",
  "windows-latest",
  "windows-2025",
  "windows-2022",
  "windows-2019",
  "windows-11-arm",
  "macos-latest",
  "macos-latest-large",
  "macos-latest-xlarge",
  "macos-15",
  "macos-15-large",
  "macos-15-xlarge",
  "macos-14",
  "macos-14-large",
  "macos-14-xlarge",
  "macos-13",
  "macos-13-large",
  "macos-13-xlarge",
  "self-hosted",
];

export const defaultValueProviders: ValueProviderConfig = {
  needs: {
    kind: ValueProviderKind.AllowedValues,
    get: context => Promise.resolve(needs(context))
  },
  "workflow-job-with": {
    kind: ValueProviderKind.AllowedValues,
    get: context => Promise.resolve(reusableJobInputs(context))
  },
  "workflow-job-secrets": {
    kind: ValueProviderKind.SuggestedValues,
    get: (context, existingValues) => Promise.resolve(reusableJobSecrets(context, existingValues))
  },
  "runs-on": {
    kind: ValueProviderKind.SuggestedValues,
    get: () => Promise.resolve(stringsToValues(DEFAULT_RUNNER_LABELS))
  }
};
