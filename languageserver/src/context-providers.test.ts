import {data, DescriptionDictionary} from "@actions/expressions";
import {WorkflowContext} from "@actions/languageservice/context/workflow-context";
import {Mode} from "@actions/languageservice/context-providers/default";
import {contextProviders} from "./context-providers";
import {RepositoryContext} from "./initializationOptions";
import {TTLCache} from "./utils/cache";

describe("contextProviders", () => {
  const mockCache = new TTLCache();
  const mockRepo: RepositoryContext = {
    id: 123,
    owner: "test-owner",
    name: "test-repo",
    organizationOwned: true,
    workspaceUri: "file:///workspace"
  };
  const mockWorkflowContext: WorkflowContext = {
    uri: "test.yaml",
    template: undefined
  };

  describe("when client is undefined", () => {
    it("should return incomplete context for secrets", async () => {
      const config = contextProviders(undefined, mockRepo, mockCache);
      const result = await config.getContext("secrets", undefined, mockWorkflowContext, Mode.Validation);

      expect(result).toBeInstanceOf(DescriptionDictionary);
      expect((result as DescriptionDictionary).complete).toBe(false);
    });

    it("should return incomplete context for vars", async () => {
      const config = contextProviders(undefined, mockRepo, mockCache);
      const result = await config.getContext("vars", undefined, mockWorkflowContext, Mode.Validation);

      expect(result).toBeInstanceOf(DescriptionDictionary);
      expect((result as DescriptionDictionary).complete).toBe(false);
    });

    it("should preserve defaultContext and mark as incomplete for secrets", async () => {
      const config = contextProviders(undefined, mockRepo, mockCache);
      const defaultContext = new DescriptionDictionary();
      defaultContext.add("EXISTING_SECRET", new data.StringData("test"));

      const result = await config.getContext("secrets", defaultContext, mockWorkflowContext, Mode.Validation);

      expect(result).toBe(defaultContext);
      expect((result as DescriptionDictionary).complete).toBe(false);
      expect((result as DescriptionDictionary).get("EXISTING_SECRET")).toBeDefined();
    });

    it("should return undefined for other contexts like steps", async () => {
      const config = contextProviders(undefined, mockRepo, mockCache);
      const result = await config.getContext("steps", undefined, mockWorkflowContext, Mode.Validation);

      expect(result).toBeUndefined();
    });
  });

  describe("when both client and repo are undefined", () => {
    it("should return incomplete context for secrets", async () => {
      const config = contextProviders(undefined, undefined, mockCache);
      const result = await config.getContext("secrets", undefined, mockWorkflowContext, Mode.Validation);

      expect(result).toBeInstanceOf(DescriptionDictionary);
      expect((result as DescriptionDictionary).complete).toBe(false);
    });

    it("should return incomplete context for vars", async () => {
      const config = contextProviders(undefined, undefined, mockCache);
      const result = await config.getContext("vars", undefined, mockWorkflowContext, Mode.Validation);

      expect(result).toBeInstanceOf(DescriptionDictionary);
      expect((result as DescriptionDictionary).complete).toBe(false);
    });
  });
});
