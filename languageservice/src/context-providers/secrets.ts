import {data, DescriptionDictionary} from "@github/actions-expressions";
import {StringData} from "@github/actions-expressions/data/string";
import {WorkflowContext} from "../context/workflow-context";
import {Mode} from "./default";
import {getDescription} from "./descriptions";

export function getSecretsContext(workflowContext: WorkflowContext, mode: Mode): DescriptionDictionary {
  const d = new DescriptionDictionary({
    key: "GITHUB_TOKEN",
    value: new data.StringData("***"),
    description: getDescription("secrets", "GITHUB_TOKEN")
  });

  if (mode === Mode.Completion) {
    const eventsConfig = workflowContext?.template?.events;
    if (eventsConfig?.workflow_call?.secrets) {
      for (const [name, value] of Object.entries(eventsConfig.workflow_call.secrets)) {
        d.add(name, new StringData(""), value.description);
      }
    }
  }

  const events = workflowContext?.template?.events;
  if (!events) {
    return d;
  }

  return d;
}
