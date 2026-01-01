import {JSONObjectReader} from "../templates/json-object-reader.js";
import {TemplateSchema} from "../templates/schema/index.js";
import ActionSchema from "../action-v1.0.min.json";

let schema: TemplateSchema;

/**
 * Returns the action.yml schema, lazily loading and caching it on first access.
 * The schema defines the structure and validation rules for action manifest files.
 */
export function getActionSchema(): TemplateSchema {
  if (schema === undefined) {
    const json = JSON.stringify(ActionSchema);
    schema = TemplateSchema.load(new JSONObjectReader(undefined, json));
  }
  return schema;
}
