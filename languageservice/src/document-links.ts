import {ErrorPolicy} from "@actions/workflow-parser/model/convert";
import {isJob, isReusableWorkflowJob} from "@actions/workflow-parser/model/type-guards";
import {File} from "@actions/workflow-parser/workflows/file";
import {parseFileReference} from "@actions/workflow-parser/workflows/file-reference";
import {TextDocument} from "vscode-languageserver-textdocument";
import {DocumentLink} from "vscode-languageserver-types";
import * as vscodeURI from "vscode-uri";
import {actionUrl, parseActionReference} from "./action.js";
import {isActionDocument} from "./utils/document-type.js";
import {mapRange} from "./utils/range.js";
import {
  getOrConvertActionTemplate,
  getOrConvertWorkflowTemplate,
  getOrParseAction,
  getOrParseWorkflow
} from "./utils/workflow-cache.js";

/**
 * Generates clickable links for action references and reusable workflows.
 */
export async function documentLinks(document: TextDocument, workspace: string | undefined): Promise<DocumentLink[]> {
  const file: File = {
    name: document.uri,
    content: document.getText()
  };

  return isActionDocument(document.uri)
    ? actionDocumentLinks(file, document.uri)
    : workflowDocumentLinks(file, document.uri, workspace);
}

/**
 * Generates clickable links for action references in action.yml files.
 */
function actionDocumentLinks(file: File, uri: string): DocumentLink[] {
  const parsedAction = getOrParseAction(file, uri);
  if (!parsedAction?.value) {
    return [];
  }

  const template = getOrConvertActionTemplate(parsedAction.context, parsedAction.value, uri, {
    errorPolicy: ErrorPolicy.TryConversion
  });

  const links: DocumentLink[] = [];

  // Only composite actions have steps
  if (template?.runs?.using !== "composite") {
    return links;
  }

  const steps = template.runs.steps ?? [];
  for (const step of steps) {
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

  return links;
}

/**
 * Generates clickable links for action references and reusable workflows in workflow files.
 */
async function workflowDocumentLinks(file: File, uri: string, workspace: string | undefined): Promise<DocumentLink[]> {
  const parsedWorkflow = getOrParseWorkflow(file, uri);
  if (!parsedWorkflow?.value) {
    return [];
  }

  const template = await getOrConvertWorkflowTemplate(parsedWorkflow.context, parsedWorkflow.value, uri, undefined, {
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
