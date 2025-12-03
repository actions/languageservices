import {DescriptionDictionary} from "@actions/expressions";
import {Octokit} from "@octokit/rest";

import {contextProviders} from "./context-providers";
import {RepositoryContext} from "./initializationOptions";
import {TTLCache} from "./utils/cache";

const mockClient = new Octokit();
const mockRepo: RepositoryContext = {
  id: 123,
  owner: "test-owner",
  name: "test-repo",
  workspaceUri: "file:///test",
  organizationOwned: false
};

describe("contextProviders", () => {
  describe("with secretsValidation = 'auto' (default)", () => {
    it("returns incomplete secrets context when client is undefined", async () => {
      const config = contextProviders(undefined, undefined, new TTLCache());
      const result = await config.getContext("secrets", undefined, {} as never, 0);

      expect(result).toBeInstanceOf(DescriptionDictionary);
      expect((result as DescriptionDictionary).complete).toBe(false);
    });

    it("returns incomplete vars context when client is undefined", async () => {
      const config = contextProviders(undefined, undefined, new TTLCache());
      const result = await config.getContext("vars", undefined, {} as never, 0);

      expect(result).toBeInstanceOf(DescriptionDictionary);
      expect((result as DescriptionDictionary).complete).toBe(false);
    });

    it("preserves existing context when provided for secrets", async () => {
      const existingContext = new DescriptionDictionary();
      existingContext.add("EXISTING_SECRET", {kind: 0, value: "***"} as never);

      const config = contextProviders(undefined, undefined, new TTLCache());
      const result = await config.getContext("secrets", existingContext, {} as never, 0);

      expect(result).toBe(existingContext);
      expect((result as DescriptionDictionary).complete).toBe(false);
    });

    it("returns undefined for other context types", async () => {
      const config = contextProviders(undefined, undefined, new TTLCache());
      const result = await config.getContext("steps", undefined, {} as never, 0);

      expect(result).toBeUndefined();
    });
  });

  describe("with secretsValidation = 'always'", () => {
    it("returns undefined for secrets when not signed in (triggers warnings)", async () => {
      const config = contextProviders(undefined, undefined, new TTLCache(), "always");
      const result = await config.getContext("secrets", undefined, {} as never, 0);

      expect(result).toBeUndefined();
    });

    it("returns undefined for vars when not signed in (triggers warnings)", async () => {
      const config = contextProviders(undefined, undefined, new TTLCache(), "always");
      const result = await config.getContext("vars", undefined, {} as never, 0);

      expect(result).toBeUndefined();
    });
  });

  describe("with secretsValidation = 'never'", () => {
    it("returns incomplete secrets context even when signed in", async () => {
      const config = contextProviders(mockClient, mockRepo, new TTLCache(), "never");
      const result = await config.getContext("secrets", undefined, {} as never, 0);

      expect(result).toBeInstanceOf(DescriptionDictionary);
      expect((result as DescriptionDictionary).complete).toBe(false);
    });

    it("returns incomplete vars context even when signed in", async () => {
      const config = contextProviders(mockClient, mockRepo, new TTLCache(), "never");
      const result = await config.getContext("vars", undefined, {} as never, 0);

      expect(result).toBeInstanceOf(DescriptionDictionary);
      expect((result as DescriptionDictionary).complete).toBe(false);
    });
  });
});
