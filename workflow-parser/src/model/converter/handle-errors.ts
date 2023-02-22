import {TemplateContext} from "../../templates/template-context";
import {TemplateToken, TemplateTokenError} from "../../templates/tokens/template-token";

export function handleTemplateTokenErrors<TResult>(
  root: TemplateToken,
  context: TemplateContext,
  defaultValue: TResult,
  f: () => TResult
): TResult {
  let r: TResult = defaultValue;

  try {
    r = f();
  } catch (err) {
    if (err instanceof TemplateTokenError) {
      context.error(err.token, err);
    } else {
      // Report error for the root node
      context.error(root, err);
    }
  }

  return r;
}
