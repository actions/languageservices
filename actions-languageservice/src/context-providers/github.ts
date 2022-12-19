import {data} from "@github/actions-expressions";
import {ExpressionData} from "@github/actions-expressions/data/expressiondata";
import {WorkflowContext} from "../context/workflow-context";
import {getInputsContext} from "./inputs";

export function getGithubContext(workflowContext: WorkflowContext): data.Dictionary {
  // https://docs.github.com/en/actions/learn-github-actions/contexts#github-context
  const keys = [
    "action",
    "action_path",
    "action_ref",
    "action_repository",
    "action_status",
    "actor",
    "api_url",
    "base_ref",
    "env",
    "event",
    "event_name",
    "event_path",
    "graphql_url",
    "head_ref",
    "job",
    "ref",
    "ref_name",
    "ref_protected",
    "ref_type",
    "path",
    "repository",
    "repository_owner",
    "repositoryUrl",
    "retention_days",
    "run_id",
    "run_number",
    "run_attempt",
    "secret_source",
    "server_url",
    "sha",
    "token",
    "triggering_actor",
    "workflow",
    "workspace"
  ];

  return new data.Dictionary(
    ...keys.map(key => {
      if (key == "event") {
        return {key, value: getEventContext(workflowContext)};
      }

      return {key, value: new data.Null()};
    })
  );
}

function getEventContext(workflowContext: WorkflowContext): ExpressionData {
  const d = new data.Dictionary();
  const events = workflowContext?.template?.events;

  if (!events) {
    return d;
  }

  const inputs = getInputsContext(workflowContext);
  if (inputs.values().length > 0) {
    d.add("inputs", inputs);
  }

  const schedule = events["schedule"];
  if (schedule && schedule.length > 0) {
    const default_cron = schedule[0].cron;
    // For now, default to the first cron expression only
    d.add("cron", new data.StringData(default_cron));
  }

  return d;
}
