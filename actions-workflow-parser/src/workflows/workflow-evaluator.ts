import { Dictionary } from "@github/actions-expressions/data/dictionary"
import {
  TemplateContext,
  TemplateValidationErrors,
} from "../templates/template-context"
import * as templateEvaluator from "../templates/template-evaluator"
import { TemplateValidationError } from "../templates/template-validation-error"
import { TemplateToken } from "../templates/tokens/template-token"
import { TraceWriter } from "../templates/trace-writer"
import { STRATEGY } from "./workflow-constants"
import { getWorkflowSchema } from "./workflow-schema"

export interface EvaluateWorkflowResult {
  value: TemplateToken | undefined
  errors: TemplateValidationError[]
}

export function evaluateStrategy(
  fileTable: string[],
  context: Dictionary,
  token: TemplateToken,
  trace: TraceWriter
): EvaluateWorkflowResult {
  const templateContext = new TemplateContext(
    new TemplateValidationErrors(),
    getWorkflowSchema(),
    trace
  )

  // Add each file name
  for (const fileName of fileTable) {
    templateContext.getFileId(fileName)
  }

  // Add expression named contexts
  for (const pair of context.pairs()) {
    templateContext.expressionNamedContexts.push(pair.key)
  }

  const value = templateEvaluator.evaluateTemplate(
    templateContext,
    STRATEGY,
    token,
    0,
    undefined
  )
  return <EvaluateWorkflowResult>{
    value: value,
    errors: templateContext.errors.getErrors(),
  }
}
