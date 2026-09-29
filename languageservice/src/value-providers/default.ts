import {ValueProviderConfig, ValueProviderKind} from "./config.js";
import {needs} from "./needs.js";
import {reusableJobInputs} from "./reusable-job-inputs.js";
import {reusableJobSecrets} from "./reusable-job-secrets.js";
import {stringsToValues} from "./strings-to-values.js";

// Refer to: https://github.com/actions/runner-images?tab=readme-ov-file#available-images
export const DEFAULT_RUNNER_LABELS = [
  "codespaces-prebuild",
  "macos-13",
  "macos-13-large",
  "macos-13-xlarge",
  "macos-14",
  "macos-14-large",
  "macos-14-xlarge",
  "macos-15",
  "macos-15-intel",
  "macos-15-large",
  "macos-15-xlarge",
  "macos-26",
  "macos-26-large",
  "macos-26-xlarge",
  "macos-latest",
  "macos-latest-large",
  "macos-latest-xlarge",
  "self-hosted",
  "ubuntu-22.04",
  "ubuntu-22.04-arm",
  "ubuntu-24.04",
  "ubuntu-24.04-arm",
  "ubuntu-latest",
  "ubuntu-slim",
  "windows-2022",
  "windows-2025",
  "windows-2025-vs2026",
  "windows-latest"
];

const runsOnValueProvider = {
  kind: ValueProviderKind.SuggestedValues,
  get: () => Promise.resolve(stringsToValues(DEFAULT_RUNNER_LABELS))
};

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
  "runs-on": runsOnValueProvider,
  "runs-on-labels": runsOnValueProvider
};
