import {data, DescriptionDictionary} from "@actions/expressions";
import {isMapping, isScalar, isString} from "@actions/workflow-parser";
import {WorkflowContext} from "../context/workflow-context";
import {scalarToData} from "../utils/scalar-to-data";

export function getStrategyContext(workflowContext: WorkflowContext): DescriptionDictionary {
  // https://docs.github.com/en/actions/learn-github-actions/contexts#strategy-context
  const keys = ["fail-fast", "job-index", "job-total", "max-parallel"];

  const strategy = workflowContext.job?.strategy ?? workflowContext.reusableWorkflowJob?.strategy;
  if (!strategy || !isMapping(strategy)) {
    return new DescriptionDictionary(
      ...keys.map(key => {
        return {key, value: new data.Null()};
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
      strategyContext.add(key, new data.Null());
    }
  }

  return strategyContext;
}
