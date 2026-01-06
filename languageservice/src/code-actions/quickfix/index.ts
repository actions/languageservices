import {FeatureFlags} from "@actions/expressions";
import {CodeActionProvider} from "../types.js";
import {addMissingInputsProvider} from "./add-missing-inputs.js";

export function getQuickfixProviders(featureFlags?: FeatureFlags): CodeActionProvider[] {
  const providers: CodeActionProvider[] = [];

  if (featureFlags?.isEnabled("missingInputsQuickfix")) {
    providers.push(addMissingInputsProvider);
  }

  return providers;
}
