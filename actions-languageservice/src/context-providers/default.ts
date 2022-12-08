import {data} from "@github/actions-expressions";
import {Kind} from "@github/actions-expressions/data/expressiondata";
import {WorkflowContext} from "../context/workflow-context";
import {ContextProviderConfig} from "./config";
import {getInputsContext} from "./inputs";
import {getMatrixContext} from "./matrix";
import {getNeedsContext} from "./needs";
import {getStepsContext} from "./steps";
import {getStrategyContext} from "./strategy";

// ContextValue is the type of the value returned by a context provider
// Null indicates that the context provider doesn't have any value to provide
export type ContextValue = data.Dictionary | data.Null;

export async function getContext(
  names: string[],
  config: ContextProviderConfig | undefined,
  workflowContext: WorkflowContext
): Promise<data.Dictionary> {
  const context = new data.Dictionary();

  const filteredNames = filterContextNames(names, workflowContext);
  for (const contextName of filteredNames) {
    let value = (await getDefaultContext(contextName, workflowContext)) || new data.Dictionary();
    if (value.kind === Kind.Null) {
      context.add(contextName, value);
      continue;
    }

    value = (await config?.getContext(contextName, value)) || value;

    context.add(contextName, value);
  }

  return context;
}

async function getDefaultContext(name: string, workflowContext: WorkflowContext): Promise<ContextValue | undefined> {
  switch (name) {
    case "runner":
      return objectToDictionary({
        os: "Linux",
        arch: "X64",
        name: "GitHub Actions 2",
        tool_cache: "/opt/hostedtoolcache",
        temp: "/home/runner/work/_temp"
      });

    case "needs":
      return getNeedsContext(workflowContext);

    case "inputs":
      return getInputsContext(workflowContext);

    case "secrets":
      return objectToDictionary({GITHUB_TOKEN: "***"});

    case "steps":
      return getStepsContext(workflowContext);

    case "strategy":
      return getStrategyContext(workflowContext);

    case "matrix":
      return getMatrixContext(workflowContext);
  }

  return undefined;
}

function objectToDictionary(object: {[key: string]: string}): data.Dictionary {
  const dictionary = new data.Dictionary();
  for (const key in object) {
    dictionary.add(key, new data.StringData(object[key]));
  }

  return dictionary;
}

function filterContextNames(contextNames: string[], workflowContext: WorkflowContext): string[] {
  return contextNames.filter(name => {
    switch (name) {
      case "matrix":
      case "strategy":
        return hasStrategy(workflowContext);
    }
    return true;
  });
}

function hasStrategy(workflowContext: WorkflowContext): boolean {
  return workflowContext.job?.strategy !== undefined;
}
