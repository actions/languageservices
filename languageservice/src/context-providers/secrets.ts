import {data, DescriptionDictionary} from "@actions/expressions";
import {StringData} from "@actions/expressions/data/string";
import {WorkflowContext} from "../context/workflow-context";
import {Mode} from "./default";
import {getDescription} from "./descriptions";

export function getSecretsContext(workflowContext: WorkflowContext, mode: Mode): DescriptionDictionary {
  const d = new DescriptionDictionary({
    key: "GITHUB_TOKEN",
    value: new data.StringData("***"),
    description: getDescription("secrets", "GITHUB_TOKEN")
  });

  const eventsConfig = workflowContext?.template?.events;
  if (eventsConfig?.workflow_call) {
    // Unpredictable secrets may be passed in via a workflow_call trigger
    d.complete = false;
    if (mode === Mode.Completion) {
      for (const [name, value] of Object.entries(eventsConfig.workflow_call.secrets || {})) {
        d.add(name, new StringData(""), value.description);
      }
    }
  }

  return d;
}
