import { TemplateContext } from "../templates/template-context"
import {
  TemplateToken,
  TemplateTokenError,
} from "../templates/tokens/template-token"
import { convertConcurrency } from "./converter/concurrency"
import { convertOn } from "./converter/events"
import { handleTemplateTokenErrors } from "./converter/handle-errors"
import { convertJobs } from "./converter/jobs"
import { WorkflowTemplate } from "./workflow-template"

export enum ErrorPolicy {
  ReturnErrorsOnly,
  TryConversion,
}

export function convertWorkflowTemplate(
  context: TemplateContext,
  root: TemplateToken,
  errorPolicy: ErrorPolicy = ErrorPolicy.ReturnErrorsOnly
): WorkflowTemplate {
  const result = {} as WorkflowTemplate

  if (
    context.errors.getErrors().length > 0 &&
    errorPolicy === ErrorPolicy.ReturnErrorsOnly
  ) {
    result.errors = context.errors.getErrors().map((x) => ({
      Message: x.message,
    }))
    return result
  }

  try {
    const rootMapping = root.assertMapping("root")

    for (const item of rootMapping) {
      const key = item.key.assertString("root key")

      switch (key.value) {
        case "on":
          result.events = handleTemplateTokenErrors(root, context, {}, () =>
            convertOn(context, item.value)
          )
          break

        case "jobs":
          result.jobs = handleTemplateTokenErrors(root, context, [], () =>
            convertJobs(context, item.value)
          )
          break

        case "concurrency":
          handleTemplateTokenErrors(root, context, {}, () =>
            convertConcurrency(context, item.value)
          )
          result.concurrency = item.value
          break
        case "env":
          result.env = item.value
          break
      }
    }
  } catch (err) {
    if (err instanceof TemplateTokenError) {
      context.error(err.token, err)
    } else {
      // Report error for the root node
      context.error(root, err)
    }
  } finally {
    if (context.errors.getErrors().length > 0) {
      result.errors = context.errors.getErrors().map((x) => ({
        Message: x.message,
      }))
    }
  }

  return result
}
