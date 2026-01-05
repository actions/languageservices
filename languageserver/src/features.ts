import {ExperimentalFeatures} from "./initializationOptions.js";

/**
 * Keys of ExperimentalFeatures that represent actual features (excludes 'all')
 */
export type ExperimentalFeatureKey = Exclude<keyof ExperimentalFeatures, "all">;

/**
 * All known experimental feature keys.
 * This list must be kept in sync with the ExperimentalFeatures interface.
 */
const allFeatureKeys: ExperimentalFeatureKey[] = ["missingInputsQuickfix"];

export class FeatureFlags {
  private readonly features: ExperimentalFeatures;

  constructor(features?: ExperimentalFeatures) {
    this.features = features ?? {};
  }

  /**
   * Check if an experimental feature is enabled.
   *
   * Resolution order:
   * 1. Explicit feature flag (if set)
   * 2. `all` flag (if set)
   * 3. false (default)
   */
  isEnabled(feature: ExperimentalFeatureKey): boolean {
    const explicit = this.features[feature];
    if (explicit !== undefined) {
      return explicit;
    }
    return this.features.all ?? false;
  }

  /**
   * Returns list of all enabled experimental features.
   */
  getEnabledFeatures(): ExperimentalFeatureKey[] {
    return allFeatureKeys.filter(key => this.isEnabled(key));
  }
}
