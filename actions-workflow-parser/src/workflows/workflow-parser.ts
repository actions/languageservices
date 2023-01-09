import {
  TemplateContext,
  TemplateValidationErrors,
} from "../templates/template-context"
import * as templateReader from "../templates/template-reader"
import { TemplateToken } from "../templates/tokens/template-token"
import { TraceWriter } from "../templates/trace-writer"
import { File } from "./file"
import { WORKFLOW_ROOT } from "./workflow-constants"
import { getWorkflowSchema } from "./workflow-schema"
import { YamlObjectReader } from "./yaml-object-reader"
export interface ParseWorkflowResult {
  context: TemplateContext
  value: TemplateToken | undefined
}

export function parseWorkflow(
  entryFileName: string,
  files: File[],
  trace: TraceWriter
): ParseWorkflowResult {
  const context = new TemplateContext(
    new TemplateValidationErrors(),
    getWorkflowSchema(),
    trace
  )

  // Add file ids
  files.forEach((x) => context.getFileId(x.name))

  const fileId = context.getFileId(entryFileName)
  const fileContent = files[fileId - 1].content
  const reader = new YamlObjectReader(context, fileId, fileContent)
  if (context.errors.count > 0) {
    // The file is not valid YAML, template errors could be misleading
    return {
      context,
      value: undefined,
    }
  }
  const result = templateReader.readTemplate(
    context,
    WORKFLOW_ROOT,
    reader,
    fileId
  )

  return <ParseWorkflowResult>{
    context,
    value: result,
  }
}
