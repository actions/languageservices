import {data, DescriptionDictionary} from "@actions/expressions";
import {Kind} from "@actions/expressions/data/expressiondata";
import {WorkflowContext} from "../context/workflow-context.js";
import {ContextProviderConfig} from "./config.js";
import {getDescription, RootContext} from "./descriptions.js";
import {getEnvContext} from "./env.js";
import {getGithubContext} from "./github.js";
import {getInputsContext} from "./inputs.js";
import {getJobContext} from "./job.js";
import {getJobsContext} from "./jobs.js";
import {getMatrixContext} from "./matrix.js";
import {getNeedsContext} from "./needs.js";
import {getSecretsContext} from "./secrets.js";
import {getStepsContext} from "./steps.js";
import {getStrategyContext} from "./strategy.js";

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

  // All context names are valid - strategy and matrix are always available
  // (with default values when no strategy block is defined)
  for (const contextName of names) {
    let value = getDefaultContext(contextName, workflowContext, mode) || new DescriptionDictionary();
    if (value.kind === Kind.Null) {
      context.add(contextName, value);
      continue;
    }

    const remoteValue = await config?.getContext(contextName, value, workflowContext, mode);
    if (remoteValue) {
      value = remoteValue;
    } else if (contextName === "secrets" || contextName === "vars") {
      // Without a context provider to fetch remote secrets/vars, we can't know
      // what values exist, so mark the context as incomplete to avoid false
      // "Context access might be invalid" warnings
      value.complete = false;
    }

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
        arch: "X64",
        debug: "1",
        environment: "github-hosted",
        name: "GitHub Actions 2",
        os: "Linux",
        temp: "/home/runner/work/_temp",
        tool_cache: "/opt/hostedtoolcache",
        workspace: "/home/runner/work/repo"
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
