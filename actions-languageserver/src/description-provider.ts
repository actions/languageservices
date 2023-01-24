import {DescriptionProvider} from "@github/actions-languageservice/hover";
import {Octokit} from "@octokit/rest";
import {TTLCache} from "./utils/cache";
import {getActionInputDescription} from "./description-providers/action-input";

export function descriptionProvider(sessionToken: string | undefined, cache: TTLCache): DescriptionProvider {
  const octokit =
    sessionToken &&
    new Octokit({
      auth: sessionToken
    });

  const getDescription: DescriptionProvider["getDescription"] = async (context, token, path) => {
    if (!octokit) {
      return undefined;
    }
    const parent = path[path.length - 1];
    if (context.step && parent.definition?.key === "step-with") {
      return await getActionInputDescription(octokit, cache, context.step, token);
    }
  };

  return {
    getDescription
  };
}
