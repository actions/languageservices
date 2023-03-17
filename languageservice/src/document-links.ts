import {ErrorPolicy} from "@github/actions-workflow-parser/model/convert";
import {isJob, isReusableWorkflowJob} from "@github/actions-workflow-parser/model/type-guards";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {parseFileReference} from "@github/actions-workflow-parser/workflows/file-reference";
import {TextDocument} from "vscode-languageserver-textdocument";
import {DocumentLink} from "vscode-languageserver-types";
import vscodeURI from "vscode-uri"; // work around issues with the vscode-uri package
import {actionUrl, parseActionReference} from "./action";
import {mapRange} from "./utils/range";
import {fetchOrConvertWorkflowTemplate, fetchOrParseWorkflow} from "./utils/workflow-cache";

export async function documentLinks(document: TextDocument, workspace: string | undefined): Promise<DocumentLink[]> {
  const file: File = {
    name: document.uri,
    content: document.getText()
  };

  const parsedWorkflow = fetchOrParseWorkflow(file, document.uri);
  if (!parsedWorkflow) {
    return [];
  }

  const template = await fetchOrConvertWorkflowTemplate(parsedWorkflow, document.uri, undefined, {
    errorPolicy: ErrorPolicy.TryConversion
  });

  const links: DocumentLink[] = [];

  for (const job of template?.jobs || []) {
    if (!job) {
      continue;
    }

    if (isJob(job)) {
      // Add links to referenced actions
      for (const step of job.steps || []) {
        if ("uses" in step) {
          const actionRef = parseActionReference(step.uses.value);
          if (!actionRef) {
            continue;
          }

          const url = actionUrl(actionRef);

          links.push({
            range: mapRange(step.uses.range),
            target: url,
            tooltip: `Open action on GitHub`
          });
        }
      }
    } else if (isReusableWorkflowJob(job)) {
      // Add links to referenced reusable workflows
      const ref = parseFileReference(job.ref.value);
      if ("repository" in ref) {
        // Remote workflow
        const url = actionUrl({
          owner: ref.owner,
          name: ref.repository,
          path: ref.path,
          ref: ref.version
        });

        links.push({
          range: mapRange(job.ref.range),
          target: url,
          tooltip: `Open reusable workflow on GitHub`
        });
      } else if (workspace) {
        // We need workspace information to generate this link
        // Local workflow, generate workspace link
        const workspaceURI = vscodeURI.URI.parse(workspace);
        const refURI = vscodeURI.Utils.joinPath(workspaceURI, job.ref.value);

        links.push({
          range: mapRange(job.ref.range),
          target: refURI.toString()
        });
      }
    }
  }

  return [...links];
}
