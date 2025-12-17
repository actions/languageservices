import {TemplateContext, TemplateValidationErrors} from "../templates/template-context.js";
import * as templateReader from "../templates/template-reader.js";
import {TemplateToken} from "../templates/tokens/template-token.js";
import {TraceWriter} from "../templates/trace-writer.js";
import {File} from "./file.js";
import {WORKFLOW_ROOT} from "./workflow-constants.js";
import {getWorkflowSchema} from "./workflow-schema.js";
import {YamlObjectReader} from "./yaml-object-reader.js";
export interface ParseWorkflowResult {
  context: TemplateContext;
  value: TemplateToken | undefined;
}

export function parseWorkflow(entryFile: File, trace: TraceWriter): ParseWorkflowResult;
export function parseWorkflow(entryFile: File, context: TemplateContext): ParseWorkflowResult;
export function parseWorkflow(entryFile: File, contextOrTrace: TraceWriter | TemplateContext): ParseWorkflowResult {
  const context =
    contextOrTrace instanceof TemplateContext
      ? contextOrTrace
      : new TemplateContext(new TemplateValidationErrors(), getWorkflowSchema(), contextOrTrace);

  const fileId = context.getFileId(entryFile.name);
  const reader = new YamlObjectReader(fileId, entryFile.content);
  if (reader.errors.length > 0) {
    // The file is not valid YAML, template errors could be misleading
    for (const err of reader.errors) {
      context.error(fileId, err.message, err.range);
    }
    return {
      context,
      value: undefined
    };
  }
  const result = templateReader.readTemplate(context, WORKFLOW_ROOT, reader, fileId);

  return <ParseWorkflowResult>{
    context,
    value: result
  };
}
