import {parseActionReference} from "@github/actions-languageservice/action";
import {isString} from "@github/actions-workflow-parser";
import {isActionStep, isReusableWorkflowJob} from "@github/actions-workflow-parser/model/type-guards";
import {FileProvider} from "@github/actions-workflow-parser/workflows/file-provider";
import {ReusableWorkflowJob} from "@github/actions-workflow-parser/model/workflow-template";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {Octokit} from "@octokit/rest";
import {fetchActionMetadata} from "../utils/action-metadata";
import {TTLCache} from "../utils/cache";

export async function getReusableWorkflowInputDescription(
  client: Octokit,
  cache: TTLCache,
  reusableWorkflowJob: ReusableWorkflowJob,
  token: TemplateToken,
  fileProvider: FileProvider
): Promise<string | undefined> {
  if (!isReusableWorkflowJob(reusableWorkflowJob)) {
    return undefined;
  }

  return "here's a description"
}
