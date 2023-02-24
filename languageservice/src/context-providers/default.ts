import {data, DescriptionDictionary} from "@actions/expressions";
import {Kind} from "@actions/expressions/data/expressiondata";
import {WorkflowContext} from "../context/workflow-context";
import {ContextProviderConfig} from "./config";
import {getDescription, RootContext} from "./descriptions";
import {getEnvContext} from "./env";
import {getGithubContext} from "./github";
import {getInputsContext} from "./inputs";
import {getJobContext} from "./job";
import {getJobsContext} from "./jobs";
import {getMatrixContext} from "./matrix";
import {getNeedsContext} from "./needs";
import {getSecretsContext} from "./secrets";
import {getStepsContext} from "./steps";
import {getStrategyContext} from "./strategy";

// ContextValue is the type of the value returned by a context provider
// Null indicates that the context provider doesn't have any value to provide
export type ContextValue = DescriptionDictionary | data.Null;

export enum Mode {
  Completion,
  Validation,
  Hover
}

export async function getContext(
  names: string[],
  config: ContextProviderConfig | undefined,
  workflowContext: WorkflowContext,
  mode: Mode
): Promise<DescriptionDictionary> {
  const context = new DescriptionDictionary();

  const filteredNames = filterContextNames(names, workflowContext);
  for (const contextName of filteredNames) {
    let value = getDefaultContext(contextName, workflowContext, mode) || new DescriptionDictionary();
    if (value.kind === Kind.Null) {
      context.add(contextName, value);
      continue;
    }

    value = (await config?.getContext(contextName, value, workflowContext, mode)) || value;

    context.add(contextName, value, getDescription(RootContext, contextName));
  }

  return context;
}

function getDefaultContext(name: string, workflowContext: WorkflowContext, mode: Mode): ContextValue | undefined {
  switch (name) {
    case "env":
      return getEnvContext(workflowContext);

    case "github":
      return getGithubContext(workflowContext, mode);

    case "inputs":
      return getInputsContext(workflowContext);

    case "reusableWorkflowJob":
    case "job":
      return getJobContext(workflowContext);

    case "jobs":
      return getJobsContext(workflowContext);

    case "matrix":
      return getMatrixContext(workflowContext, mode);

    case "needs":
      return getNeedsContext(workflowContext);

    case "runner":
      return objectToDictionary({
        os: "Linux",
        arch: "X64",
        name: "GitHub Actions 2",
        tool_cache: "/opt/hostedtoolcache",
        temp: "/home/runner/work/_temp"
      });

    case "secrets":
      return getSecretsContext(workflowContext, mode);

    case "steps":
      return getStepsContext(workflowContext);

    case "strategy":
      return getStrategyContext(workflowContext);
  }

  return undefined;
}

function objectToDictionary(object: {[key: string]: string}): DescriptionDictionary {
  const dictionary = new DescriptionDictionary();

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
  return workflowContext.job?.strategy !== undefined || workflowContext.reusableWorkflowJob?.strategy !== undefined;
}
