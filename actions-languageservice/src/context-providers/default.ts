import {data} from "@github/actions-expressions";
import {WorkflowContext} from "../context/workflow-context";
import {ContextProviderConfig} from "./config";
import {getNeedsContext} from "./needs";

export async function getContext(
  names: string[],
  config: ContextProviderConfig | undefined,
  workflowContext: WorkflowContext
): Promise<data.Dictionary> {
  const context = new data.Dictionary();

  for (const contextName of names) {
    let value: data.Dictionary | undefined;

    value = getDefaultContext(contextName, workflowContext);

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

function getDefaultContext(name: string, workflowContext: WorkflowContext): data.Dictionary | undefined {
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
