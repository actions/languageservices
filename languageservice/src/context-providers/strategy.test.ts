import {data} from "@actions/expressions";
import {Job} from "@actions/workflow-parser/model/workflow-template";
import {BooleanToken} from "@actions/workflow-parser/templates/tokens/boolean-token";
import {MappingToken} from "@actions/workflow-parser/templates/tokens/mapping-token";
import {NumberToken} from "@actions/workflow-parser/templates/tokens/number-token";
import {StringToken} from "@actions/workflow-parser/templates/tokens/string-token";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";
import {WorkflowContext} from "../context/workflow-context.js";
import {getStrategyContext} from "./strategy.js";

function stringToToken(value: string) {
  return new StringToken(undefined, undefined, value, undefined);
}

function boolToToken(value: boolean) {
  return new BooleanToken(undefined, undefined, value, undefined);
}

function numberToToken(value: number) {
  return new NumberToken(undefined, undefined, value, undefined);
}

function contextFromStrategy(strategy?: TemplateToken) {
  return {
    job: {
      strategy: strategy
    }
  } as WorkflowContext;
}

describe("strategy context", () => {
  describe("no strategy defined", () => {
    it("returns defaults when job is undefined", () => {
      const workflowContext = {} as WorkflowContext;

      const context = getStrategyContext(workflowContext);

      expect(context.get("fail-fast")).toEqual(new data.BooleanData(true));
      expect(context.get("job-index")).toEqual(new data.NumberData(0));
      expect(context.get("job-total")).toEqual(new data.NumberData(1));
      expect(context.get("max-parallel")).toEqual(new data.NumberData(1));
    });

    it("returns defaults when strategy is undefined", () => {
      const job = {} as Job;
      const workflowContext = {job} as WorkflowContext;

      const context = getStrategyContext(workflowContext);

      expect(context.get("fail-fast")).toEqual(new data.BooleanData(true));
      expect(context.get("job-index")).toEqual(new data.NumberData(0));
      expect(context.get("job-total")).toEqual(new data.NumberData(1));
      expect(context.get("max-parallel")).toEqual(new data.NumberData(1));
    });

    it("returns defaults when strategy is not a mapping", () => {
      const workflowContext = contextFromStrategy(stringToToken("hello"));

      const context = getStrategyContext(workflowContext);

      expect(context.get("fail-fast")).toEqual(new data.BooleanData(true));
      expect(context.get("job-index")).toEqual(new data.NumberData(0));
      expect(context.get("job-total")).toEqual(new data.NumberData(1));
      expect(context.get("max-parallel")).toEqual(new data.NumberData(1));
    });
  });

  describe("strategy defined with partial properties", () => {
    it("uses specified fail-fast, defaults for others", () => {
      const strategy = new MappingToken(undefined, undefined, undefined);
      strategy.add(stringToToken("fail-fast"), boolToToken(false));
      const workflowContext = contextFromStrategy(strategy);

      const context = getStrategyContext(workflowContext);

      expect(context.get("fail-fast")).toEqual(new data.BooleanData(false));
      expect(context.get("job-index")).toEqual(new data.NumberData(0));
      expect(context.get("job-total")).toEqual(new data.NumberData(1));
      expect(context.get("max-parallel")).toEqual(new data.NumberData(1));
    });

    it("uses specified max-parallel, defaults for others", () => {
      const strategy = new MappingToken(undefined, undefined, undefined);
      strategy.add(stringToToken("max-parallel"), numberToToken(5));
      const workflowContext = contextFromStrategy(strategy);

      const context = getStrategyContext(workflowContext);

      expect(context.get("fail-fast")).toEqual(new data.BooleanData(true));
      expect(context.get("job-index")).toEqual(new data.NumberData(0));
      expect(context.get("job-total")).toEqual(new data.NumberData(1));
      expect(context.get("max-parallel")).toEqual(new data.NumberData(5));
    });

    it("only has matrix defined, all strategy properties use defaults", () => {
      const strategy = new MappingToken(undefined, undefined, undefined);
      const matrix = new MappingToken(undefined, undefined, undefined);
      strategy.add(stringToToken("matrix"), matrix);
      const workflowContext = contextFromStrategy(strategy);

      const context = getStrategyContext(workflowContext);

      expect(context.get("fail-fast")).toEqual(new data.BooleanData(true));
      expect(context.get("job-index")).toEqual(new data.NumberData(0));
      expect(context.get("job-total")).toEqual(new data.NumberData(1));
      expect(context.get("max-parallel")).toEqual(new data.NumberData(1));
    });
  });

  describe("strategy with all properties defined", () => {
    it("uses all specified values", () => {
      const strategy = new MappingToken(undefined, undefined, undefined);
      strategy.add(stringToToken("fail-fast"), boolToToken(false));
      strategy.add(stringToToken("max-parallel"), numberToToken(3));
      const workflowContext = contextFromStrategy(strategy);

      const context = getStrategyContext(workflowContext);

      expect(context.get("fail-fast")).toEqual(new data.BooleanData(false));
      // job-index and job-total are runtime values, not specified in YAML
      expect(context.get("job-index")).toEqual(new data.NumberData(0));
      expect(context.get("job-total")).toEqual(new data.NumberData(1));
      expect(context.get("max-parallel")).toEqual(new data.NumberData(3));
    });
  });
});
