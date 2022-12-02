import {data} from "@github/actions-expressions";
import {WorkflowContext} from "../context/workflow-context";

export function getInputsContext(workflowContext: WorkflowContext): data.Dictionary {
  const d = new data.Dictionary();
  if (!workflowContext?.template?.events) {
    return d;
  }

  const event = workflowContext.template.events["workflow_dispatch"];
  if (!event) {
    return d;
  }

  const inputs = event.inputs;
  for (const inputName of Object.keys(inputs)) {
    const input = inputs[inputName];
    switch (input.type) {
      case "choice":
        if (input.default) {
          d.add(inputName, new data.StringData(input.default as string));
        } else {
          // Default to the first input or an empty string
          d.add(inputName, new data.StringData((input.options || [""])[0]));
        }
        break;

      case "environment":
        if (input.default) {
          d.add(inputName, new data.StringData(input.default as string));
        } else {
          // For now default to an empty value if there is no default value. This will always be an environment, so
          // we could also dynamically look up environments and default to the first one, but leaving this as a
          // future enhancement for now.
          d.add(inputName, new data.StringData(""));
        }
        break;

      case "boolean":
        d.add(inputName, new data.BooleanData((input.default as boolean) || false));
        break;

      case "string":
      default:
        d.add(inputName, new data.StringData((input.default as string) || inputName));
        break;
    }
  }

  return d;
}
