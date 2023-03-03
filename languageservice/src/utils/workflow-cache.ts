import {convertWorkflowTemplate, parseWorkflow} from "@github/actions-workflow-parser";
import {WorkflowTemplateConverterOptions} from "@github/actions-workflow-parser/model/convert";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {ParseWorkflowResult} from "@github/actions-workflow-parser";
import {WorkflowTemplate} from "@github/actions-workflow-parser";
import {nullTrace} from "../nulltrace";
import { CompletionConfig } from "../complete";

const parsedWorkflowCache = new Map<string, ParseWorkflowResult>();
const workflowTemplateCache = new Map<string, WorkflowTemplate>();

export function cacheParsedWorkflow(uri: string, parsedWorkflowResult: ParseWorkflowResult) {
  parsedWorkflowCache.set(uri, parsedWorkflowResult);
}

export function getParsedWorkflowCacheEntry(uri: string): ParseWorkflowResult | undefined {
  return parsedWorkflowCache.get(uri);
}

export function clearParsedCacheEntry(uri: string) {
  parsedWorkflowCache.delete(uri);
}

export function clearParsedCache() {
  parsedWorkflowCache.clear();
}

export function cacheWorkflowTemplate(uri: string, workflowTemplate: WorkflowTemplate) {
  workflowTemplateCache.set(uri, workflowTemplate);
}

export function getWorkflowTemplateCacheEntry(uri: string): WorkflowTemplate | undefined {
  return workflowTemplateCache.get(uri);
}

export function clearWorkflowTemplateCacheEntry(uri: string) {
  workflowTemplateCache.delete(uri);
}

export function clearWorkflowTemplateCache() {
  workflowTemplateCache.clear();
}

export function getParsedWorkflow(file: File, uri: string): ParseWorkflowResult | undefined {
  let result = getParsedWorkflowCacheEntry(uri);
  if (!result || !result.value) {
    result = parseWorkflow(file, nullTrace);
    if (!result.value) {
      return undefined;
    }
    cacheParsedWorkflow(uri, result)
  }
  return result;
}

export async function getWorkflowTemplate(file: File, parsedWorkflow: ParseWorkflowResult, uri: string, config?: CompletionConfig, options?: WorkflowTemplateConverterOptions): Promise<WorkflowTemplate> {
  let template = getWorkflowTemplateCacheEntry(uri);
  if (!template) {
    template = await convertWorkflowTemplate(file.name, parsedWorkflow.context, parsedWorkflow.value!, config?.fileProvider, options);
    cacheWorkflowTemplate(uri, template);
  }
  return template;
}