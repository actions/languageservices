import {FeatureFlags} from "./features.js";

describe("FeatureFlags", () => {
  describe("isEnabled", () => {
    it("returns false by default when no options provided", () => {
      const flags = new FeatureFlags();
      expect(flags.isEnabled("missingInputsQuickfix")).toBe(false);
    });

    it("returns false by default when empty options provided", () => {
      const flags = new FeatureFlags({});
      expect(flags.isEnabled("missingInputsQuickfix")).toBe(false);
    });

    it("returns true when feature is explicitly enabled", () => {
      const flags = new FeatureFlags({missingInputsQuickfix: true});
      expect(flags.isEnabled("missingInputsQuickfix")).toBe(true);
    });

    it("returns false when feature is explicitly disabled", () => {
      const flags = new FeatureFlags({missingInputsQuickfix: false});
      expect(flags.isEnabled("missingInputsQuickfix")).toBe(false);
    });

    it("returns true when all is enabled", () => {
      const flags = new FeatureFlags({all: true});
      expect(flags.isEnabled("missingInputsQuickfix")).toBe(true);
    });

    it("explicit feature flag takes precedence over all:true", () => {
      const flags = new FeatureFlags({all: true, missingInputsQuickfix: false});
      expect(flags.isEnabled("missingInputsQuickfix")).toBe(false);
    });

    it("explicit feature flag takes precedence over all:false", () => {
      const flags = new FeatureFlags({all: false, missingInputsQuickfix: true});
      expect(flags.isEnabled("missingInputsQuickfix")).toBe(true);
    });
  });

  describe("getEnabledFeatures", () => {
    it("returns empty array when no features enabled", () => {
      const flags = new FeatureFlags();
      expect(flags.getEnabledFeatures()).toEqual([]);
    });

    it("returns enabled features", () => {
      const flags = new FeatureFlags({missingInputsQuickfix: true});
      expect(flags.getEnabledFeatures()).toEqual(["missingInputsQuickfix"]);
    });

    it("returns all features when all is enabled", () => {
      const flags = new FeatureFlags({all: true});
      expect(flags.getEnabledFeatures()).toEqual(["missingInputsQuickfix"]);
    });
  });
});
