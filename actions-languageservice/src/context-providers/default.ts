import {data} from "@github/actions-expressions";
import {WorkflowContext} from "../context/workflow-context";
import {ContextProviderConfig} from "./config";
import {getInputsContext} from "./inputs";
import {getNeedsContext} from "./needs";
import {getStepsContext} from "./steps";
import {getStrategyContext} from "./strategy";

export async function getContext(
  names: string[],
  config: ContextProviderConfig | undefined,
  workflowContext: WorkflowContext
): Promise<data.Dictionary> {
  const context = new data.Dictionary();

  for (const contextName of names) {
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
      return getStrategyContext();
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
