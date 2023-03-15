import {convertWorkflowTemplate, parseWorkflow} from "@github/actions-workflow-parser";
import {WorkflowTemplateConverterOptions} from "@github/actions-workflow-parser/model/convert";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {ParseWorkflowResult} from "@github/actions-workflow-parser";
import {WorkflowTemplate} from "@github/actions-workflow-parser";
import {nullTrace} from "../nulltrace";
import {CompletionConfig} from "../complete";

const parsedWorkflowCache = new Map<string, ParseWorkflowResult>();
const workflowTemplateCache = new Map<string, WorkflowTemplate>();

export function clearCacheEntry(uri: string) {
  parsedWorkflowCache.delete(uri);
  workflowTemplateCache.delete(uri);
}

export function clearCache() {
  parsedWorkflowCache.clear();
  workflowTemplateCache.clear();
}

export function fetchOrParseWorkflow(file: File, uri: string): ParseWorkflowResult | undefined {
  const cachedResult = parsedWorkflowCache.get(uri);
  if (cachedResult) {
    return cachedResult;
  }
  const result = parseWorkflow(file, nullTrace);
  parsedWorkflowCache.set(uri, result);
  return result;
}

export async function fetchOrConvertWorkflowTemplate(
  parsedWorkflow: ParseWorkflowResult,
  uri: string,
  config?: CompletionConfig,
  options?: WorkflowTemplateConverterOptions
): Promise<WorkflowTemplate> {
  let template = workflowTemplateCache.get(uri);
  if (!template) {
    template = await convertWorkflowTemplate(
      parsedWorkflow.context,
      // TODO: @joshmgross We can't assume that the value is non-null here
      parsedWorkflow.value!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
      config?.fileProvider,
      options
    );
    workflowTemplateCache.set(uri, template);
  }
  return template;
}
