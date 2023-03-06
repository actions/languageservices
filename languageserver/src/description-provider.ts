import {DescriptionProvider} from "@github/actions-languageservice/hover";
import {Octokit} from "@octokit/rest";
import {getActionInputDescription} from "./description-providers/action-input";
import {TTLCache} from "./utils/cache";
import {getActionDescription} from "./description-providers/action-description";

export function descriptionProvider(client: Octokit | undefined, cache: TTLCache): DescriptionProvider {
  const getDescription: DescriptionProvider["getDescription"] = async (context, token, path) => {
    if (!client || !context.step) {
      return undefined;
    }

    const parent = path[path.length - 1];
    if (parent.definition?.key === "step-with") {
      return await getActionInputDescription(client, cache, context.step, token);
    }

    if (parent.definition?.key === "step-uses") {
      return await getActionDescription(client, cache, context.step);
    }
  };

  return {
    getDescription
  };
}
