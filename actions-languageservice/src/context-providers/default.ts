import {data} from "@github/actions-expressions";
import {WorkflowContext} from "../context/workflow-context";
import {ContextProviderConfig} from "./config";
import {getInputsContext} from "./inputs";
import {getNeedsContext} from "./needs";
import {getStepsContext} from "./steps";
import {allowStrategyContext, getStrategyContext} from "./strategy";

export async function getContext(
  names: string[],
  config: ContextProviderConfig | undefined,
  workflowContext: WorkflowContext
): Promise<data.Dictionary> {
  const context = new data.Dictionary();

  const filteredNames = filterContextNames(names, workflowContext);
  for (const contextName of filteredNames) {
    let value: data.Dictionary | undefined;

    value = await getDefaultContext(contextName, workflowContext);

    if (!value) {
      value = await config?.getContext(contextName);
    }

    if (!value) {
      value = new data.Dictionary();
    }

    context.add(contextName, value);
  }

  return context;
}

async function getDefaultContext(name: string, workflowContext: WorkflowContext): Promise<data.Dictionary | undefined> {
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

    case "steps":
      return getStepsContext(workflowContext);

    case "strategy":
      return getStrategyContext(workflowContext);
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
      case "strategy":
        return allowStrategyContext(workflowContext);
    }
    return true;
  });
}
