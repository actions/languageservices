import {detectDocumentType, isActionDocument, isWorkflowDocument} from "./document-type";

describe("detectDocumentType", () => {
  describe("action files", () => {
    it("detects action.yml", () => {
      expect(detectDocumentType("/path/to/action.yml")).toBe("action");
    });

    it("detects action.yaml", () => {
      expect(detectDocumentType("/path/to/action.yaml")).toBe("action");
    });

    it("detects action.yml with case insensitivity", () => {
      expect(detectDocumentType("/path/to/ACTION.YML")).toBe("action");
      expect(detectDocumentType("/path/to/Action.Yaml")).toBe("action");
    });

    it("detects nested action.yml", () => {
      expect(detectDocumentType("/repo/.github/actions/my-action/action.yml")).toBe("action");
    });

    it("detects bare action.yml", () => {
      expect(detectDocumentType("action.yml")).toBe("action");
    });

    it("handles Windows paths", () => {
      expect(detectDocumentType("C:\\Users\\me\\action.yml")).toBe("action");
      expect(detectDocumentType("C:\\repo\\.github\\actions\\my-action\\action.yml")).toBe("action");
    });
  });

  describe("workflow files", () => {
    it("detects workflow files in .github/workflows", () => {
      expect(detectDocumentType("/repo/.github/workflows/ci.yml")).toBe("workflow");
      expect(detectDocumentType("/repo/.github/workflows/build.yaml")).toBe("workflow");
    });

    it("detects workflow files in .github/workflows-lab", () => {
      expect(detectDocumentType("/repo/.github/workflows-lab/ci.yml")).toBe("workflow");
      expect(detectDocumentType("/repo/.github/workflows-lab/build.yaml")).toBe("workflow");
    });

    it("detects workflow files case insensitively", () => {
      expect(detectDocumentType("/repo/.github/workflows/CI.YML")).toBe("workflow");
    });

    it("handles Windows paths for workflows", () => {
      expect(detectDocumentType("C:\\repo\\.github\\workflows\\ci.yml")).toBe("workflow");
      expect(detectDocumentType("C:\\repo\\.github\\workflows-lab\\ci.yml")).toBe("workflow");
    });

    it("workflow path takes precedence over action filename", () => {
      // Edge case: action.yml inside .github/workflows should be treated as workflow
      expect(detectDocumentType("/repo/.github/workflows/action.yml")).toBe("workflow");
      expect(detectDocumentType("/repo/.github/workflows/action.yaml")).toBe("workflow");
      expect(detectDocumentType("/repo/.github/workflows-lab/action.yml")).toBe("workflow");
    });
  });

  describe("unknown files", () => {
    it("returns unknown for other yaml files", () => {
      expect(detectDocumentType("/path/to/config.yml")).toBe("unknown");
      expect(detectDocumentType("/path/to/docker-compose.yaml")).toBe("unknown");
    });

    it("returns unknown for non-yaml files", () => {
      expect(detectDocumentType("/path/to/file.txt")).toBe("unknown");
    });
  });
});

describe("isActionDocument", () => {
  it("returns true for action files", () => {
    expect(isActionDocument("/path/to/action.yml")).toBe(true);
  });

  it("returns false for workflow files", () => {
    expect(isActionDocument("/repo/.github/workflows/ci.yml")).toBe(false);
  });

  it("returns false for unknown files", () => {
    expect(isActionDocument("/path/to/config.yml")).toBe(false);
  });
});

describe("isWorkflowDocument", () => {
  it("returns true for workflow files", () => {
    expect(isWorkflowDocument("/repo/.github/workflows/ci.yml")).toBe(true);
  });

  it("returns false for action files", () => {
    expect(isWorkflowDocument("/path/to/action.yml")).toBe(false);
  });

  it("returns false for unknown files", () => {
    expect(isWorkflowDocument("/path/to/config.yml")).toBe(false);
  });
});
