import {convertWorkflowTemplate, parseWorkflow} from "@github/actions-workflow-parser";
import {ErrorPolicy} from "@github/actions-workflow-parser/model/convert";
import {isJob} from "@github/actions-workflow-parser/model/type-guards";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {TextDocument} from "vscode-languageserver-textdocument";
import {DocumentLink} from "vscode-languageserver-types";
import {actionUrl, parseActionReference} from "./action";
import {nullTrace} from "./nulltrace";
import {mapRange} from "./utils/range";

export async function documentLinks(document: TextDocument): Promise<DocumentLink[]> {
  const file: File = {
    name: document.uri,
    content: document.getText()
  };

  const result = parseWorkflow(file, nullTrace);
  if (!result.value) {
    return [];
  }

  const template = await convertWorkflowTemplate(result.context, result.value!, undefined, {
    errorPolicy: ErrorPolicy.TryConversion
  });

  // Add links to referenced actions
  const actionLinks: DocumentLink[] = [];

  for (const job of template?.jobs || []) {
    if (!job || !isJob(job)) {
      continue;
    }
    for (const step of job.steps || []) {
      if ("uses" in step) {
        const actionRef = parseActionReference(step.uses.value);
        if (!actionRef) {
          continue;
        }

        const url = actionUrl(actionRef);

        actionLinks.push({
          range: mapRange(step.uses.range),
          target: url,
          tooltip: `Open action on GitHub`
        });
      }
    }
  }

  return [...actionLinks];
}
