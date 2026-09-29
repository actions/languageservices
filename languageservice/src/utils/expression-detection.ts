import {isString} from "@actions/workflow-parser";
import {OPEN_EXPRESSION} from "@actions/workflow-parser/templates/template-constants";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/index";

/**
 * Workflow schema if-condition definition keys.
 * - job-if: job level if condition
 * - step-if: step level if condition
 * - snapshot-if: snapshot if condition
 */
const WORKFLOW_IF_DEFINITIONS = new Set(["job-if", "step-if", "snapshot-if"]);

/**
 * Action schema if-condition definition keys.
 * - step-if: composite action step if condition (run-step and uses-step)
 * - runs-if: pre-if and post-if at the runs level (node/docker actions)
 */
const ACTION_IF_DEFINITIONS = new Set(["step-if", "runs-if"]);

export function isPotentiallyExpression(token: TemplateToken, isAction: boolean): boolean {
  // Check if token contains expression syntax
  if (isString(token) && token.value != null && token.value.indexOf(OPEN_EXPRESSION) >= 0) {
    return true;
  }

  // Check if token is an if-condition (always treated as expressions)
  if (!token.definition?.key) {
    return false;
  }

  // Definition keys differ between workflow and action schemas
  if (isAction) {
    return ACTION_IF_DEFINITIONS.has(token.definition.key);
  } else {
    return WORKFLOW_IF_DEFINITIONS.has(token.definition.key);
  }
}
