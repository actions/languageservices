import {DescriptionDictionary} from "@actions/expressions";
import {WorkflowContext} from "../context/workflow-context.js";
import {getWorkflowExpressionContext, Mode} from "./default.js";

describe("getWorkflowExpressionContext", () => {
  const emptyWorkflowContext: WorkflowContext = {
    uri: "test.yaml",
    template: undefined
  };

  describe("when no contextProviderConfig is provided", () => {
    it("should mark secrets context as incomplete", async () => {
      const result = await getWorkflowExpressionContext(["secrets"], undefined, emptyWorkflowContext, Mode.Validation);

      const secretsContext = result.get("secrets") as DescriptionDictionary;
      expect(secretsContext).toBeDefined();
      expect(secretsContext.complete).toBe(false);
    });

    it("should mark vars context as incomplete", async () => {
      const result = await getWorkflowExpressionContext(["vars"], undefined, emptyWorkflowContext, Mode.Validation);

      const varsContext = result.get("vars") as DescriptionDictionary;
      expect(varsContext).toBeDefined();
      expect(varsContext.complete).toBe(false);
    });

    it("should not mark other contexts as incomplete", async () => {
      const result = await getWorkflowExpressionContext(
        ["env", "github"],
        undefined,
        emptyWorkflowContext,
        Mode.Validation
      );

      const envContext = result.get("env") as DescriptionDictionary;
      const githubContext = result.get("github") as DescriptionDictionary;

      // These contexts are derived from the workflow file, so they can be complete
      expect(envContext).toBeDefined();
      expect(envContext.complete).toBe(true);
      expect(githubContext).toBeDefined();
      expect(githubContext.complete).toBe(true);
    });
  });

  describe("when contextProviderConfig returns a value", () => {
    it("should use the provided context for secrets", async () => {
      const providedContext = new DescriptionDictionary();
      providedContext.complete = true; // Provider fetched from API, so it's complete

      const config = {
        getContext: () => Promise.resolve(providedContext)
      };

      const result = await getWorkflowExpressionContext(["secrets"], config, emptyWorkflowContext, Mode.Validation);

      const secretsContext = result.get("secrets");
      expect(secretsContext).toBe(providedContext);
      expect((secretsContext as DescriptionDictionary).complete).toBe(true);
    });

    it("should use the provided context for vars", async () => {
      const providedContext = new DescriptionDictionary();
      providedContext.complete = true;

      const config = {
        getContext: () => Promise.resolve(providedContext)
      };

      const result = await getWorkflowExpressionContext(["vars"], config, emptyWorkflowContext, Mode.Validation);

      const varsContext = result.get("vars");
      expect(varsContext).toBe(providedContext);
      expect((varsContext as DescriptionDictionary).complete).toBe(true);
    });
  });

  describe("when contextProviderConfig returns undefined", () => {
    it("should mark secrets as incomplete", async () => {
      const config = {
        getContext: () => Promise.resolve(undefined)
      };

      const result = await getWorkflowExpressionContext(["secrets"], config, emptyWorkflowContext, Mode.Validation);

      const secretsContext = result.get("secrets") as DescriptionDictionary;
      expect(secretsContext.complete).toBe(false);
    });

    it("should mark vars as incomplete", async () => {
      const config = {
        getContext: () => Promise.resolve(undefined)
      };

      const result = await getWorkflowExpressionContext(["vars"], config, emptyWorkflowContext, Mode.Validation);

      const varsContext = result.get("vars") as DescriptionDictionary;
      expect(varsContext.complete).toBe(false);
    });
  });
});
