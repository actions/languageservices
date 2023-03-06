import {DescriptionProvider} from "@github/actions-languageservice/hover";
import {Octokit} from "@octokit/rest";
import {getActionInputDescription} from "./description-providers/action-input";
import {TTLCache} from "./utils/cache";
import {isString} from "@github/actions-workflow-parser/templates/tokens/type-guards";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {getActionDescription} from "./description-providers/action-description";

export function descriptionProvider(client: Octokit | undefined, cache: TTLCache): DescriptionProvider {
  const getDescription: DescriptionProvider["getDescription"] = async (context, token, path) => {
    if (!client || !context.step) {
      return undefined;
    }

    if (isStepInput(path)) {
      return await getActionInputDescription(client, cache, context.step, token);
    }

    if (isStepUses(path)) {
      return await getActionDescription(client, cache, context.step);
    }
  };

  return {
    getDescription
  };
}

function isStepInput(path: TemplateToken[]): boolean {
  const parent = path[path.length - 1];
  return parent.definition?.key === "step-with";
}

function isStepUses(path: TemplateToken[]): boolean {
  if (path.length < 2) {
    return false;
  }
  const parent = path[path.length - 1];
  const grandparent = path[path.length - 2];
  return isString(parent) && parent.value === "uses" && grandparent.definition?.key === "regular-step";
}
