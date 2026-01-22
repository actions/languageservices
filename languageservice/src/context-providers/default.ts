import {data, DescriptionDictionary} from "@actions/expressions";
import {Kind} from "@actions/expressions/data/expressiondata";
import {ActionContext, getActionInputs, getActionStepIdsBefore} from "../context/action-context.js";
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

// ContextValue is the type of the value returned by a context provider
// Null indicates that the context provider doesn't have any value to provide
export type ContextValue = DescriptionDictionary | data.Null;

export enum Mode {
  Completion,
  Validation,
  Hover
}

/**
 * Build expression context for workflow files (e.g., github.*, steps.*, needs.*)
 */
export async function getWorkflowExpressionContext(
  names: string[],
  config: ContextProviderConfig | undefined,
  workflowContext: WorkflowContext | undefined,
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

    const remoteValue = workflowContext
      ? await config?.getContext(contextName, value, workflowContext, mode)
      : undefined;
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

/**
 * Maps context name to its provider (e.g., "steps" -> getStepsContext)
 */
function getDefaultContext(
  name: string,
  workflowContext: WorkflowContext | undefined,
  mode: Mode
): ContextValue | undefined {
  switch (name) {
    case "env":
      return workflowContext ? getEnvContext(workflowContext) : new DescriptionDictionary();

    case "github":
      return getGithubContext(workflowContext, mode);

    case "inputs":
      return workflowContext ? getInputsContext(workflowContext) : new DescriptionDictionary();

    case "reusableWorkflowJob":
    case "job":
      return workflowContext ? getJobContext(workflowContext) : new DescriptionDictionary();

    case "jobs":
      return workflowContext ? getJobsContext(workflowContext) : new DescriptionDictionary();

    case "matrix":
      return workflowContext ? getMatrixContext(workflowContext, mode) : new DescriptionDictionary();

    case "needs":
      return workflowContext ? getNeedsContext(workflowContext) : new DescriptionDictionary();

    case "runner":
      return getRunnerContext();

    case "secrets":
      return workflowContext ? getSecretsContext(workflowContext, mode) : new DescriptionDictionary();

    case "steps":
      return workflowContext ? getStepsContext(workflowContext) : new DescriptionDictionary();

    case "strategy":
      return getStrategyContext();
  }

  return undefined;
}

/**
 * Returns the strategy context with default values (fail-fast, job-index, etc.)
 */
function getStrategyContext(): DescriptionDictionary {
  // https://docs.github.com/en/actions/learn-github-actions/contexts#strategy-context
  return new DescriptionDictionary(
    {key: "fail-fast", value: new data.BooleanData(true), description: getDescription("strategy", "fail-fast")},
    {key: "job-index", value: new data.NumberData(0), description: getDescription("strategy", "job-index")},
    {key: "job-total", value: new data.NumberData(1), description: getDescription("strategy", "job-total")},
    {key: "max-parallel", value: new data.NumberData(1), description: getDescription("strategy", "max-parallel")}
  );
}

/**
 * Returns the runner context with environment info (arch, os, temp, workspace, etc.)
 */
function getRunnerContext(): DescriptionDictionary {
  // https://docs.github.com/en/actions/learn-github-actions/contexts#runner-context
  return new DescriptionDictionary(
    {key: "arch", value: new data.StringData("X64"), description: getDescription("runner", "arch")},
    {key: "debug", value: new data.StringData("1"), description: getDescription("runner", "debug")},
    {
      key: "environment",
      value: new data.StringData("github-hosted"),
      description: getDescription("runner", "environment")
    },
    {key: "name", value: new data.StringData("GitHub Actions 2"), description: getDescription("runner", "name")},
    {key: "os", value: new data.StringData("Linux"), description: getDescription("runner", "os")},
    {key: "temp", value: new data.StringData("/home/runner/work/_temp"), description: getDescription("runner", "temp")},
    {
      key: "tool_cache",
      value: new data.StringData("/opt/hostedtoolcache"),
      description: getDescription("runner", "tool_cache")
    },
    {
      key: "workspace",
      value: new data.StringData("/home/runner/work/repo"),
      description: getDescription("runner", "workspace")
    }
  );
}

/**
 * Get context for expression completion in action.yml files.
 * Actions have a more limited set of contexts available compared to workflows.
 */
export function getActionExpressionContext(
  names: string[],
  config: ContextProviderConfig | undefined,
  actionContext: ActionContext | undefined,
  mode: Mode
): DescriptionDictionary {
  const context = new DescriptionDictionary();

  for (const contextName of names) {
    const value = getDefaultActionContext(contextName, actionContext, mode);
    if (value) {
      context.add(contextName, value, getDescription(RootContext, contextName));
    }
  }

  return context;
}

/**
 * Maps context name to its provider for action.yml files (e.g., "inputs" -> getActionInputsContext)
 */
function getDefaultActionContext(
  name: string,
  actionContext: ActionContext | undefined,
  mode: Mode
): ContextValue | undefined {
  switch (name) {
    case "inputs":
      // Return empty dictionary if no context - still allows completion, just without specific input names
      return actionContext ? getActionInputsContext(actionContext) : new DescriptionDictionary();

    case "steps":
      // Return empty dictionary if no context - still allows completion, just without specific step IDs
      return actionContext ? getActionStepsContext(actionContext) : new DescriptionDictionary();

    case "github":
      // Use the same github context but without workflow-specific event info
      // Actions inherit the event context from the calling workflow at runtime
      return getGithubContext(undefined, mode);

    case "runner":
      return getRunnerContext();

    case "env": {
      // Actions can access env but we don't know what env vars the calling workflow defines
      // Mark as incomplete to avoid false positive "Context access might be invalid" warnings
      const envContext = new DescriptionDictionary();
      envContext.complete = false;
      return envContext;
    }

    case "job": {
      // https://docs.github.com/en/actions/learn-github-actions/contexts#job-context
      const jobContext = new DescriptionDictionary();
      jobContext.add("status", new data.StringData(""), getDescription("job", "status"));
      jobContext.add("check_run_id", new data.StringData(""), getDescription("job", "check_run_id"));
      const containerContext = new DescriptionDictionary();
      containerContext.add("id", new data.StringData(""), getDescription("job", "container.id"));
      containerContext.add("network", new data.StringData(""), getDescription("job", "container.network"));
      jobContext.add("container", containerContext, getDescription("job", "container"));
      jobContext.add("services", new DescriptionDictionary(), getDescription("job", "services"));
      return jobContext;
    }

    case "strategy":
      return getStrategyContext();

    case "matrix": {
      // Actions can access matrix context at runtime but we don't know the calling workflow's matrix
      // Mark as incomplete to avoid false positive "Context access might be invalid" warnings
      const matrixContext = new DescriptionDictionary();
      matrixContext.complete = false;
      return matrixContext;
    }
  }

  return undefined;
}

/**
 * Get inputs context for action files based on defined inputs
 */
function getActionInputsContext(actionContext: ActionContext): DescriptionDictionary {
  const dict = new DescriptionDictionary();
  const inputs = getActionInputs(actionContext.template);

  for (const input of inputs) {
    dict.add(input.id, new data.StringData(""), input.description || "");
  }

  return dict;
}

/**
 * Get steps context for composite action files based on step IDs
 */
function getActionStepsContext(actionContext: ActionContext): DescriptionDictionary {
  const dict = new DescriptionDictionary();
  const stepIds = getActionStepIdsBefore(actionContext);

  for (const stepId of stepIds) {
    const stepDict = new DescriptionDictionary();
    stepDict.add("outputs", new DescriptionDictionary(), getDescription("steps", "outputs"));
    stepDict.add("outcome", new data.StringData("success"), getDescription("steps", "outcome"));
    stepDict.add("conclusion", new data.StringData("success"), getDescription("steps", "conclusion"));
    dict.add(stepId, stepDict, `Step: ${stepId}`);
  }

  return dict;
}
