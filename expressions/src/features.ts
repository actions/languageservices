/**
 * Experimental feature flags.
 *
 * Individual feature flags take precedence over `all`.
 * Example: { all: true, missingInputsQuickfix: false } enables all
 * experimental features EXCEPT missingInputsQuickfix.
 *
 * When a feature graduates to stable, its flag becomes a no-op
 * (the feature will be enabled regardless of the configuration value).
 */
export interface ExperimentalFeatures {
  /**
   * Enable all experimental features.
   * Individual feature flags take precedence over this setting.
   * @default false
   */
  all?: boolean;

  /**
   * Enable quickfix code action for missing required action inputs.
   * @default false
   */
  missingInputsQuickfix?: boolean;
}

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
