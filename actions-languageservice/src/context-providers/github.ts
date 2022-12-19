import {data} from "@github/actions-expressions";
import {ExpressionData} from "@github/actions-expressions/data/expressiondata";
import {WorkflowContext} from "../context/workflow-context";
import {eventPayloads} from "./events/eventPayloads";
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
  const eventsConfig = workflowContext?.template?.events;

  if (!eventsConfig) {
    return d;
  }

  const inputs = getInputsContext(workflowContext);
  if (inputs.values().length > 0) {
    d.add("inputs", inputs);
  }

  const schedule = eventsConfig["schedule"];
  if (schedule && schedule.length > 0) {
    const default_cron = schedule[0].cron;
    // For now, default to the first cron expression only
    d.add("schedule", new data.StringData(default_cron));
  }

  const events = Object.keys(eventsConfig);
  for (let e of events) {
    let payload = eventPayloads[e];
    if (payload) {
      merge(d, payload);
    }
  }

  return d;
}

function merge(d: data.Dictionary, toAdd: any): data.Dictionary {
  for (let key of Object.keys(toAdd)) {
    const value = toAdd[key];
    if (value && typeof value === "object" && !d.get(key)) {
      d.add(key, merge(new data.Dictionary(), value));
    } else {
      d.add(key, new data.Null());
    }
  }

  return d;
}
