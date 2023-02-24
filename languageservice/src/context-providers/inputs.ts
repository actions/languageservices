import {data, DescriptionDictionary} from "@actions/expressions";
import {InputConfig} from "@actions/workflow-parser/model/workflow-template";
import {WorkflowContext} from "../context/workflow-context";

export function getInputsContext(workflowContext: WorkflowContext): DescriptionDictionary {
  const d = new DescriptionDictionary();

  const events = workflowContext?.template?.events;
  if (!events) {
    return d;
  }

  const dispatch = events["workflow_dispatch"];
  if (dispatch?.inputs) {
    addInputs(d, dispatch.inputs);
  }

  const call = events["workflow_call"];
  if (call?.inputs) {
    addInputs(d, call.inputs);
  }

  return d;
}

function addInputs(d: DescriptionDictionary, inputs: {[inputName: string]: InputConfig}) {
  for (const inputName of Object.keys(inputs)) {
    const input = inputs[inputName];
    switch (input.type) {
      case "choice":
        if (input.default) {
          d.add(inputName, new data.StringData(input.default as string), input.description);
        } else {
          // Default to the first input or an empty string
          d.add(inputName, new data.StringData((input.options || [""])[0]), input.description);
        }
        break;

      case "environment":
        if (input.default) {
          d.add(inputName, new data.StringData(input.default as string), input.description);
        } else {
          // For now default to an empty value if there is no default value. This will always be an environment, so
          // we could also dynamically look up environments and default to the first one, but leaving this as a
          // future enhancement for now.
          d.add(inputName, new data.StringData(""));
        }
        break;

      case "boolean":
        d.add(inputName, new data.BooleanData((input.default as boolean) || false), input.description);
        break;

      case "string":
      default:
        d.add(inputName, new data.StringData((input.default as string) || inputName), input.description);
        break;
    }
  }
}
