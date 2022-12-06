import {data} from "@github/actions-expressions";

export function getStrategyContext(): data.Dictionary {
  // https://docs.github.com/en/actions/learn-github-actions/contexts#strategy-context
  const keys = ["fail-fast", "job-index", "job-total", "max-parallel"];

  return new data.Dictionary(
    ...keys.map(key => {
      return {key, value: new data.Null()};
    })
  );
}
