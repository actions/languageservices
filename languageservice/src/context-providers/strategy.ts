import {data, DescriptionDictionary} from "@actions/expressions";
import {isMapping, isScalar, isString} from "@actions/workflow-parser";
import {WorkflowContext} from "../context/workflow-context";
import {scalarToData} from "../utils/scalar-to-data";

// Default strategy values when no strategy block is defined
const DEFAULT_STRATEGY = {
  "fail-fast": new data.BooleanData(true),
  "job-index": new data.NumberData(0),
  "job-total": new data.NumberData(1),
  "max-parallel": new data.NumberData(1)
};

export function getStrategyContext(workflowContext: WorkflowContext): DescriptionDictionary {
  // https://docs.github.com/en/actions/learn-github-actions/contexts#strategy-context
  const keys = ["fail-fast", "job-index", "job-total", "max-parallel"];

  const strategy = workflowContext.job?.strategy ?? workflowContext.reusableWorkflowJob?.strategy;
  if (!strategy || !isMapping(strategy)) {
    // No strategy defined - return defaults that match runtime behavior
    return new DescriptionDictionary(
      ...keys.map(key => {
        return {key, value: DEFAULT_STRATEGY[key as keyof typeof DEFAULT_STRATEGY]};
      })
    );
  }

  const strategyContext = new DescriptionDictionary();
  for (const pair of strategy) {
    if (!isString(pair.key)) {
      continue;
    }
    if (!keys.includes(pair.key.value)) {
      continue;
    }

    const value = isScalar(pair.value) ? scalarToData(pair.value) : new data.Null();
    strategyContext.add(pair.key.value, value);
  }

  for (const key of keys) {
    if (!strategyContext.get(key)) {
      // Use default value for missing properties
      strategyContext.add(key, DEFAULT_STRATEGY[key as keyof typeof DEFAULT_STRATEGY]);
    }
  }

  return strategyContext;
}
