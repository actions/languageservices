import {TemplateContext} from "../../../templates/template-context";
import {TemplateToken} from "../../../templates/tokens";
import {isMapping, isString, isSequence} from "../../../templates/tokens/type-guards";

type RunsOn = {
  labels: Set<string>;
  group: string;
};

export function convertRunsOn(context: TemplateContext, token: TemplateToken): RunsOn {
  const labels = convertRunsOnLabels(token);

  if (!isMapping(token)) {
    return {
      labels,
      group: ""
    };
  }

  let group = "";

  for (const item of token) {
    const key = item.key.assertString("job runs-on property name");
    switch (key.value) {
      case "group": {
        if (item.value.isExpression) {
          continue;
        }

        const groupName = item.value.assertString("job runs-on group name").value;
        const names = groupName.split("/");
        switch (names.length) {
          case 1: {
            group = groupName;
            break;
          }
          case 2: {
            if (!["org", "organization", "ent", "enterprise"].includes(names[0])) {
              context.error(
                item.value,
                `Invalid runs-on group name '${groupName}. Please use 'organization/' or 'enterprise/' prefix to target a single runner group.'`
              );
              continue;
            }
            if (!names[1]) {
              context.error(item.value, `Invalid runs-on group name '${groupName}'.`);
              continue;
            }

            group = groupName;
            break;
          }
          default: {
            context.error(
              item.value,
              `Invalid runs-on group name '${groupName}. Please use 'organization/' or 'enterprise/' prefix to target a single runner group.'`
            );
            break;
          }
        }
        break;
      }
      case "labels": {
        const mapLabels = convertRunsOnLabels(item.value);
        for (const label of mapLabels) {
          labels.add(label);
        }
        break;
      }
    }
  }

  return {
    labels,
    group
  };
}

function convertRunsOnLabels(token: TemplateToken): Set<string> {
  const labels = new Set<string>();
  if (token.isExpression) {
    return labels;
  }

  if (isString(token)) {
    labels.add(token.value);
    return labels;
  }

  if (isSequence(token)) {
    for (const item of token) {
      if (item.isExpression) {
        continue;
      }

      const label = item.assertString("job runs-on label sequence item");
      labels.add(label.value);
    }
  }

  return labels;
}
