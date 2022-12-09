import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";

export function getAllowedContext(token: TemplateToken, parent: TemplateToken | null | undefined): string[] {
  // Workaround for https://github.com/github/c2c-actions-experience/issues/6876
  // Context is inherited from the parent
  const allowedContext = new Set<string>();
  for (const t of [token, parent]) {
    if (t?.definition?.readerContext) {
      for (const context of t.definition.readerContext) {
        allowedContext.add(context);
      }
    }
  }
  return Array.from(allowedContext);
}
