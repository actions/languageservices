import {data, DescriptionDictionary, isDescriptionDictionary} from "@actions/expressions";
import {ExpressionData} from "@actions/expressions/data/expressiondata";
import {TypesFilterConfig} from "@actions/workflow-parser/model/workflow-template";
import {WorkflowContext} from "../context/workflow-context";
import {Mode} from "./default";
import {getDescription} from "./descriptions";
import {getEventPayload, getSupportedEventTypes} from "./events/eventPayloads";
import {getInputsContext} from "./inputs";

export function getGithubContext(workflowContext: WorkflowContext, mode: Mode): DescriptionDictionary {
  // https://docs.github.com/en/actions/learn-github-actions/contexts#github-cwontext
  const keys = [
    "action",
    "action_path",
    "action_ref",
    "action_repository",
    "action_status",
    "actor",
    "actor_id",
    "api_url",
    "base_ref",
    "env",
    "event",
    "event_name",
    "event_path",
    "graphql_url",
    "head_ref",
    "job",
    "job_workflow_sha",
    "path",
    "ref",
    "ref_name",
    "ref_protected",
    "ref_type",
    "repository",
    "repository_id",
    "repository_owner",
    "repository_owner_id",
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
    "workflow_ref",
    "workflow_sha",
    "workspace"
  ];

  return new DescriptionDictionary(
    ...keys.map(key => {
      const description = getDescription("github", key);

      if (key == "event") {
        return {
          key,
          value: getEventContext(workflowContext, mode),
          description
        };
      }

      return {
        key,
        value: new data.Null(),
        description
      };
    })
  );
}

function getEventContext(workflowContext: WorkflowContext, mode: Mode): ExpressionData {
  const d = new DescriptionDictionary();
  const eventsConfig = workflowContext?.template?.events;

  if (!eventsConfig) {
    return d;
  }

  // For callable workflows, the event is inherited from the calling workflow
  // Allow any value for this case
  // This includes github.event.inputs, which is only available via the inputs context
  if (eventsConfig.workflow_call && mode == Mode.Validation) {
    return new data.Null();
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
  for (const eventName of events) {
    const event = eventsConfig[eventName] as TypesFilterConfig;

    let types = getTypes(eventName, event.types);
    const payloadEventName = getPayloadEventName(eventName);

    if (types.length === 1 && types[0] === "default") {
      types = getSupportedEventTypes(eventName);
    }

    for (const type of types) {
      const eventPayload = getEventPayload(payloadEventName, type);

      if (!eventPayload) {
        continue;
      }

      // Merge the event payload into the event context
      merge(d, eventPayload);
    }
  }

  return d;
}

function getPayloadEventName(eventName: string): string {
  switch (eventName) {
    // Some events are aliases for other webhooks
    case "pull_request_target":
      return "pull_request";

    default:
      return eventName;
  }
}

function getTypes(event: string, types: string[] | undefined): string[] {
  const typesOrDefault = (types: string[] | undefined, defaultTypes: string[]): string[] =>
    !types || types.length === 0 ? defaultTypes : types;

  switch (event) {
    case "merge_group":
      return typesOrDefault(types, ["checks_requested"]);

    case "pull_request":
    case "pull_request_target":
      return typesOrDefault(types, ["opened", "reopened", "synchronize"]);

    case "repository_dispatch":
      // Types can be used for custom filtering for repository_dispatch events. Always use default
      return ["default"];

    default:
      return typesOrDefault(types, ["default"]);
  }
}

function merge(target: DescriptionDictionary, toMerge: DescriptionDictionary): DescriptionDictionary {
  for (const p of toMerge.pairs()) {
    if (isDescriptionDictionary(p.value)) {
      const existingValue = target.get(p.key);
      if (existingValue && isDescriptionDictionary(existingValue)) {
        // Merge the dictionaries, do not overwrite existing values
        merge(existingValue, p.value);

        continue;
      }
    }

    target.add(p.key, p.value, p.description);
  }

  return target;
}
