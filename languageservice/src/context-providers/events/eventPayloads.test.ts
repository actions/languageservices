import {DescriptionDictionary} from "@actions/expressions";
import {getEventPayload, getSupportedEventTypes} from "./eventPayloads.js";

describe("eventPayloads", () => {
  describe("getSupportedEventTypes", () => {
    it("returns action types for push event", () => {
      const types = getSupportedEventTypes("push");
      expect(types).toContain("default");
    });

    it("returns action types for issues event", () => {
      const types = getSupportedEventTypes("issues");
      expect(types.length).toBeGreaterThan(1);
      expect(types).toContain("opened");
      expect(types).toContain("closed");
    });
  });

  describe("getEventPayload", () => {
    it("returns payload for push event", () => {
      const payload = getEventPayload("push", "default");
      expect(payload).toBeDefined();

      // Verify common fields exist
      expect(payload?.get("ref")).toBeDefined();
      expect(payload?.get("repository")).toBeDefined();
      expect(payload?.get("sender")).toBeDefined();
    });

    it("returns payload for issues event", () => {
      const payload = getEventPayload("issues", "opened");
      expect(payload).toBeDefined();

      expect(payload?.get("action")).toBeDefined();
      expect(payload?.get("issue")).toBeDefined();
      expect(payload?.get("repository")).toBeDefined();
    });

    it("preserves descriptions for hover documentation", () => {
      // This test ensures bodyParameters[].description is not stripped
      // during JSON optimization. The description field is used for hover
      // documentation in the workflow editor.
      const payload = getEventPayload("push", "default");
      expect(payload).toBeDefined();

      // Get the description for a well-known field
      // repository should have a description like "A repository on GitHub"
      const repoDescription = payload?.getDescription("repository");
      expect(repoDescription).toBeDefined();
      expect(repoDescription?.length).toBeGreaterThan(0);

      // sender should have a description
      const senderDescription = payload?.getDescription("sender");
      expect(senderDescription).toBeDefined();
      expect(senderDescription?.length).toBeGreaterThan(0);
    });

    it("preserves childParamsGroups for nested property access", () => {
      // This test ensures bodyParameters[].childParamsGroups is not stripped
      // during JSON optimization. childParamsGroups defines nested properties
      // used for autocompletion like github.event.repository.owner.login
      const payload = getEventPayload("push", "default");
      expect(payload).toBeDefined();

      // repository has nested properties like owner, license, etc.
      const repository = payload?.get("repository") as DescriptionDictionary | undefined;
      expect(repository).toBeDefined();

      // repository.owner should exist (nested via childParamsGroups)
      const owner = repository?.get("owner") as DescriptionDictionary | undefined;
      expect(owner).toBeDefined();

      // repository.owner.login should exist (deeply nested)
      const login = owner?.get("login");
      expect(login).toBeDefined();
    });

    it("preserves name fields for property identification", () => {
      // This test ensures bodyParameters[].name is not stripped
      // during JSON optimization. The name field identifies each property.
      const payload = getEventPayload("issues", "opened");
      expect(payload).toBeDefined();

      // Verify well-known property names exist
      expect(payload?.get("action")).toBeDefined();
      expect(payload?.get("issue")).toBeDefined();
      expect(payload?.get("repository")).toBeDefined();
      expect(payload?.get("sender")).toBeDefined();

      // Verify nested property names work
      const issue = payload?.get("issue") as DescriptionDictionary | undefined;
      expect(issue?.get("title")).toBeDefined();
      expect(issue?.get("number")).toBeDefined();
      expect(issue?.get("user")).toBeDefined();
    });

    it("returns undefined for unknown event", () => {
      const payload = getEventPayload("not_a_real_event", "default");
      expect(payload).toBeUndefined();
    });
  });
});
