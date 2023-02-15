import {parseFileReference} from "@github/actions-workflow-parser/workflows/file-reference";
import {isString} from "@github/actions-workflow-parser";
import {isReusableWorkflowJob} from "@github/actions-workflow-parser/model/type-guards";
import {FileProvider} from "@github/actions-workflow-parser/workflows/file-provider";
import {ReusableWorkflowJob} from "@github/actions-workflow-parser/model/workflow-template";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {Octokit} from "@octokit/rest";
import {TTLCache} from "../utils/cache";

export async function getReusableWorkflowInputDescription(
  client: Octokit,
  cache: TTLCache,
  reusableWorkflowJob: ReusableWorkflowJob,
  token: TemplateToken,
  template: FileProvider
): Promise<string | undefined> {
  if (!isReusableWorkflowJob(reusableWorkflowJob)) {
    return undefined;
  }

  return "here's a description"
}
