import {TemplateContext} from "./template-context.js";
import {TemplateToken} from "./tokens/template-token.js";

/**
 * Result of parsing a template file (workflow or action)
 */
export interface TemplateParseResult {
  context: TemplateContext;
  value: TemplateToken | undefined;
}
