import {DescriptionProvider} from "@github/actions-languageservice/hover";
import {Octokit} from "@octokit/rest";
import {getActionInputDescription} from "./description-providers/action-input";
import {getReusableWorkflowInputDescription} from "./description-providers/reusable-workflow-input";
import {TTLCache} from "./utils/cache";

export function descriptionProvider(client: Octokit | undefined, cache: TTLCache): DescriptionProvider {
  const getDescription: DescriptionProvider["getDescription"] = async (context, token, path, template) => {
    if (!client) {
      return undefined;
    }

    const parent = path[path.length - 1];
    if (context.step && parent.definition?.key === "step-with") {
      return await getActionInputDescription(client, cache, context.step, token);
    }

    if (context.reusableWorkflowJob && template && parent.definition?.key === "workflow-job-with") {
      return await getReusableWorkflowInputDescription(context.reusableWorkflowJob, token, template);
    }
  };

  return {
    getDescription
  };
}
