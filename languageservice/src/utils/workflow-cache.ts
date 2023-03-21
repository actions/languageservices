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
  parsedWorkflowCache.delete(workflowKey(uri, true));
  workflowTemplateCache.delete(uri);
  workflowTemplateCache.delete(workflowKey(uri, true));
}

export function clearCache() {
  parsedWorkflowCache.clear();
  workflowTemplateCache.clear();
}

/**
 * Parses a workflow file and caches the result
 * @param transformed Indicates whether the workflow has been transformed before parsing
 * @returns the {@link ParseWorkflowResult}
 */
export function fetchOrParseWorkflow(file: File, uri: string, transformed = false): ParseWorkflowResult {
  const key = workflowKey(uri, transformed);
  const cachedResult = parsedWorkflowCache.get(key);
  if (cachedResult) {
    return cachedResult;
  }
  const result = parseWorkflow(file, nullTrace);
  parsedWorkflowCache.set(key, result);
  return result;
}

/**
 * Converts a workflow template and caches the result
 * @param transformed Indicates whether the workflow has been transformed before parsing
 * @returns the converted {@link WorkflowTemplate}
 */
export async function fetchOrConvertWorkflowTemplate(
  context: TemplateContext,
  template: TemplateToken,
  uri: string,
  config?: CompletionConfig,
  options?: WorkflowTemplateConverterOptions,
  transformed = false
): Promise<WorkflowTemplate> {
  const key = workflowKey(uri, transformed);
  const cachedTemplate = workflowTemplateCache.get(key);
  if (cachedTemplate) {
    return cachedTemplate;
  }
  const workflowTemplate = await convertWorkflowTemplate(context, template, config?.fileProvider, options);
  workflowTemplateCache.set(key, workflowTemplate);
  return workflowTemplate;
}

// Use a separate cache key for transformed workflows
function workflowKey(uri: string, transformed: boolean): string {
  if (transformed) {
    return `transformed-${uri}`;
  }
  return uri;
}
