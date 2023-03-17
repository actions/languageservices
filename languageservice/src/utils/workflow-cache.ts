import {
  convertWorkflowTemplate,
  parseWorkflow,
  ParseWorkflowResult,
  WorkflowTemplate
} from "@github/actions-workflow-parser";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {WorkflowTemplateConverterOptions} from "@github/actions-workflow-parser/model/convert";
import {TemplateContext} from "@github/actions-workflow-parser/templates/template-context";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";

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
  context: TemplateContext,
  template: TemplateToken,
  uri: string,
  config?: CompletionConfig,
  options?: WorkflowTemplateConverterOptions
): Promise<WorkflowTemplate> {
  const cachedTemplate = workflowTemplateCache.get(uri);
  if (cachedTemplate) {
    return cachedTemplate;
  }
  const workflowTemplate = await convertWorkflowTemplate(context, template, config?.fileProvider, options);
  workflowTemplateCache.set(uri, workflowTemplate);
  return workflowTemplate;
}
