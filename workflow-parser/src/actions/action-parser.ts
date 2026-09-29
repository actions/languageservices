import {TemplateParseResult} from "../templates/template-parse-result.js";
import {TemplateContext, TemplateValidationErrors} from "../templates/template-context.js";
import * as templateReader from "../templates/template-reader.js";
import {TraceWriter} from "../templates/trace-writer.js";
import {File} from "../workflows/file.js";
import {YamlObjectReader} from "../workflows/yaml-object-reader.js";
import {ACTION_ROOT} from "./action-constants.js";
import {getActionSchema} from "./action-schema.js";

/**
 * Parses an action.yml file and validates it against the action schema.
 * Returns a TemplateParseResult containing the parsed template token tree
 * and any validation errors found during parsing.
 */
export function parseAction(entryFile: File, trace: TraceWriter): TemplateParseResult;
export function parseAction(entryFile: File, context: TemplateContext): TemplateParseResult;
export function parseAction(entryFile: File, contextOrTrace: TraceWriter | TemplateContext): TemplateParseResult {
  const context =
    contextOrTrace instanceof TemplateContext
      ? contextOrTrace
      : new TemplateContext(new TemplateValidationErrors(), getActionSchema(), contextOrTrace);

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
  const result = templateReader.readTemplate(context, ACTION_ROOT, reader, fileId);

  return <TemplateParseResult>{
    context,
    value: result
  };
}
