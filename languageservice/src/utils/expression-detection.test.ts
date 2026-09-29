import {isPotentiallyExpression} from "./expression-detection.js";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";
import {TokenType} from "@actions/workflow-parser/templates/tokens/types";
import {Definition} from "@actions/workflow-parser/templates/schema/definition";

// Helper to create a mock TemplateToken with the properties we need to test
function createMockToken(options: {value?: string; definitionKey?: string; isString?: boolean}): TemplateToken {
  const {value = "", definitionKey, isString = true} = options;

  const mockDefinition = definitionKey ? ({key: definitionKey} as Definition) : undefined;

  return {
    value: isString ? value : undefined,
    definition: mockDefinition,
    templateTokenType: isString ? TokenType.String : TokenType.Mapping,
    // Required by isString type guard (isLiteral checks isLiteral property)
    isLiteral: isString,
    isScalar: isString
  } as unknown as TemplateToken;
}

describe("isPotentiallyExpression", () => {
  describe("expression markers", () => {
    it("returns true when token value contains ${{", () => {
      const token = createMockToken({value: "${{ github.actor }}"});
      expect(isPotentiallyExpression(token, false)).toBe(true);
      expect(isPotentiallyExpression(token, true)).toBe(true);
    });

    it("returns true when token value contains embedded ${{", () => {
      const token = createMockToken({value: "Hello ${{ github.actor }}!"});
      expect(isPotentiallyExpression(token, false)).toBe(true);
      expect(isPotentiallyExpression(token, true)).toBe(true);
    });

    it("returns false when token value does not contain ${{", () => {
      const token = createMockToken({value: "plain text"});
      expect(isPotentiallyExpression(token, false)).toBe(false);
      expect(isPotentiallyExpression(token, true)).toBe(false);
    });

    it("returns false for non-string tokens without expression marker", () => {
      const token = createMockToken({isString: false});
      expect(isPotentiallyExpression(token, false)).toBe(false);
      expect(isPotentiallyExpression(token, true)).toBe(false);
    });
  });

  describe("workflow schema if-conditions", () => {
    it("returns true for job-if definition in workflow", () => {
      const token = createMockToken({value: "success()", definitionKey: "job-if"});
      expect(isPotentiallyExpression(token, false)).toBe(true);
    });

    it("returns false for job-if definition in action (not valid in action schema)", () => {
      const token = createMockToken({value: "success()", definitionKey: "job-if"});
      expect(isPotentiallyExpression(token, true)).toBe(false);
    });

    it("returns true for step-if definition in workflow", () => {
      const token = createMockToken({value: "failure()", definitionKey: "step-if"});
      expect(isPotentiallyExpression(token, false)).toBe(true);
    });

    it("returns true for snapshot-if definition in workflow", () => {
      const token = createMockToken({value: "always()", definitionKey: "snapshot-if"});
      expect(isPotentiallyExpression(token, false)).toBe(true);
    });

    it("returns false for snapshot-if definition in action (not valid in action schema)", () => {
      const token = createMockToken({value: "always()", definitionKey: "snapshot-if"});
      expect(isPotentiallyExpression(token, true)).toBe(false);
    });
  });

  describe("action schema if-conditions", () => {
    describe("composite action step if (run and uses)", () => {
      it("returns true for step-if definition in action", () => {
        const token = createMockToken({value: "success()", definitionKey: "step-if"});
        expect(isPotentiallyExpression(token, true)).toBe(true);
      });

      it("returns true for step-if with run step condition", () => {
        // Composite action run step: if condition
        const token = createMockToken({value: "github.event_name == 'push'", definitionKey: "step-if"});
        expect(isPotentiallyExpression(token, true)).toBe(true);
      });

      it("returns true for step-if with uses step condition", () => {
        // Composite action uses step: if condition
        const token = createMockToken({value: "runner.os == 'Linux'", definitionKey: "step-if"});
        expect(isPotentiallyExpression(token, true)).toBe(true);
      });
    });

    describe("pre-if and post-if (node/docker actions)", () => {
      it("returns true for runs-if definition in action (pre-if)", () => {
        const token = createMockToken({value: "runner.os == 'Linux'", definitionKey: "runs-if"});
        expect(isPotentiallyExpression(token, true)).toBe(true);
      });

      it("returns true for runs-if definition in action (post-if)", () => {
        const token = createMockToken({value: "always()", definitionKey: "runs-if"});
        expect(isPotentiallyExpression(token, true)).toBe(true);
      });

      it("returns false for runs-if definition in workflow (not valid in workflow schema)", () => {
        const token = createMockToken({value: "always()", definitionKey: "runs-if"});
        expect(isPotentiallyExpression(token, false)).toBe(false);
      });
    });
  });

  describe("mixed scenarios", () => {
    it("returns true when expression marker present even if definition is not if-related", () => {
      const token = createMockToken({value: "${{ github.actor }}", definitionKey: "some-other-definition"});
      expect(isPotentiallyExpression(token, false)).toBe(true);
      expect(isPotentiallyExpression(token, true)).toBe(true);
    });

    it("returns true when both expression marker and if definition present", () => {
      const token = createMockToken({value: "${{ success() }}", definitionKey: "step-if"});
      expect(isPotentiallyExpression(token, false)).toBe(true);
      expect(isPotentiallyExpression(token, true)).toBe(true);
    });

    it("returns false for plain text with non-if definition", () => {
      const token = createMockToken({value: "plain text", definitionKey: "string"});
      expect(isPotentiallyExpression(token, false)).toBe(false);
      expect(isPotentiallyExpression(token, true)).toBe(false);
    });

    it("returns false when token has no definition and no expression marker", () => {
      const token = createMockToken({value: "plain text"});
      expect(isPotentiallyExpression(token, false)).toBe(false);
      expect(isPotentiallyExpression(token, true)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles empty string value", () => {
      const token = createMockToken({value: ""});
      expect(isPotentiallyExpression(token, false)).toBe(false);
      expect(isPotentiallyExpression(token, true)).toBe(false);
    });

    it("handles expression marker as if-condition value", () => {
      const token = createMockToken({value: "${{ always() }}", definitionKey: "job-if"});
      expect(isPotentiallyExpression(token, false)).toBe(true);
      // For action, job-if is not valid, but ${{ is present
      expect(isPotentiallyExpression(token, true)).toBe(true);
    });

    it("handles partial expression marker", () => {
      const token = createMockToken({value: "${incomplete"});
      expect(isPotentiallyExpression(token, false)).toBe(false);
      expect(isPotentiallyExpression(token, true)).toBe(false);
    });

    it("handles ${{ at different positions", () => {
      const startToken = createMockToken({value: "${{ foo }} bar"});
      const middleToken = createMockToken({value: "bar ${{ foo }} baz"});
      const endToken = createMockToken({value: "bar ${{ foo }}"});

      expect(isPotentiallyExpression(startToken, false)).toBe(true);
      expect(isPotentiallyExpression(middleToken, false)).toBe(true);
      expect(isPotentiallyExpression(endToken, false)).toBe(true);
    });
  });
});
