import {TemplateContext} from "../templates/template-context";
import {TemplateToken, TemplateTokenError} from "../templates/tokens/template-token";
import {FileProvider} from "../workflows/file-provider";
import {parseFileReference} from "../workflows/file-reference";
import {parseWorkflow} from "../workflows/workflow-parser";
import {convertConcurrency} from "./converter/concurrency";
import {convertOn} from "./converter/events";
import {handleTemplateTokenErrors} from "./converter/handle-errors";
import {convertJobs} from "./converter/jobs";
import {convertReferencedWorkflow} from "./converter/referencedWorkflow";
import {isReusableWorkflowJob} from "./type-guards";
import {WorkflowTemplate} from "./workflow-template";

const workflowTemplateCache = new Map<string, WorkflowTemplate>();

export enum ErrorPolicy {
  ReturnErrorsOnly,
  TryConversion
}

export type WorkflowTemplateConverterOptions = {
  /**
   * The maximum depth of reusable workflows allowed in the workflow.
   * If this depth is exceeded, an error will be reported.
   * If {@link fetchReusableWorkflowDepth} is less than this value, the maximum depth
   * won't be enforced.
   * Default: 4
   */
  maxReusableWorkflowDepth?: number;
  /**
   * The depth to fetch reusable workflows, up to {@link maxReusableWorkflowDepth}.
   * Currently only a fetch depth of 0 or 1 is supported.
   * Default: 0
   */
  fetchReusableWorkflowDepth?: number;

  /**
   * The error policy to use when converting the workflow.
   * By default, conversion will be skipped if there are errors in the {@link TemplateContext}.
   */
  errorPolicy?: ErrorPolicy;
};

const defaultOptions: Required<WorkflowTemplateConverterOptions> = {
  maxReusableWorkflowDepth: 4,
  fetchReusableWorkflowDepth: 0,
  errorPolicy: ErrorPolicy.ReturnErrorsOnly
};

export async function convertWorkflowTemplate(
  fileName: string,
  context: TemplateContext,
  root: TemplateToken,
  fileProvider?: FileProvider,
  options: WorkflowTemplateConverterOptions = defaultOptions
): Promise<WorkflowTemplate> {
  const cachedResult = workflowTemplateCache.get(fileName)
  if (cachedResult) {
    return cachedResult;
  }

  const result = {} as WorkflowTemplate;
  const opts = getOptionsWithDefaults(options);

  if (context.errors.getErrors().length > 0 && opts.errorPolicy === ErrorPolicy.ReturnErrorsOnly) {
    result.errors = context.errors.getErrors().map(x => ({
      Message: x.message
    }));
    workflowTemplateCache.set(fileName, result);
    return result;
  }

  if (fileProvider === undefined && opts.fetchReusableWorkflowDepth > 0) {
    context.error(root, new Error("A file provider is required to fetch reusable workflows"));
  }

  try {
    const rootMapping = root.assertMapping("root");

    for (const item of rootMapping) {
      const key = item.key.assertString("root key");

      switch (key.value) {
        case "on":
          result.events = handleTemplateTokenErrors(root, context, {}, () => convertOn(context, item.value));
          break;

        case "jobs":
          result.jobs = handleTemplateTokenErrors(root, context, [], () => convertJobs(context, item.value));
          break;

        case "concurrency":
          handleTemplateTokenErrors(root, context, {}, () => convertConcurrency(context, item.value));
          result.concurrency = item.value;
          break;
        case "env":
          result.env = item.value;
          break;
      }
    }

    // Load referenced workflows
    for (const job of result.jobs || []) {
      if (isReusableWorkflowJob(job)) {
        if (opts.maxReusableWorkflowDepth === 0) {
          context.error(job.ref, new Error("Reusable workflows are not allowed"));
          continue;
        }

        if (opts.fetchReusableWorkflowDepth === 0 || fileProvider === undefined) {
          continue;
        }

        try {
          const file = await fileProvider.getFileContent(parseFileReference(job.ref.value));
          const workflow = parseWorkflow(file, context);
          if (!workflow.value) {
            continue;
          }
          convertReferencedWorkflow(context, workflow.value, job);
        } catch {
          context.error(job.ref, new Error("Unable to find reusable workflow"));
        }
      }
    }
  } catch (err) {
    if (err instanceof TemplateTokenError) {
      context.error(err.token, err);
    } else {
      // Report error for the root node
      context.error(root, err);
    }
  } finally {
    if (context.errors.getErrors().length > 0) {
      result.errors = context.errors.getErrors().map(x => ({
        Message: x.message
      }));
    }
  }

  workflowTemplateCache.set(fileName, result);
  return result;
}

function getOptionsWithDefaults(options: WorkflowTemplateConverterOptions): Required<WorkflowTemplateConverterOptions> {
  return {
    maxReusableWorkflowDepth:
      options.maxReusableWorkflowDepth !== undefined
        ? options.maxReusableWorkflowDepth
        : defaultOptions.maxReusableWorkflowDepth,
    fetchReusableWorkflowDepth:
      options.fetchReusableWorkflowDepth !== undefined
        ? options.fetchReusableWorkflowDepth
        : defaultOptions.fetchReusableWorkflowDepth,
    errorPolicy: options.errorPolicy !== undefined ? options.errorPolicy : defaultOptions.errorPolicy
  };
}

export function clearWorkflowTemplateCacheEntry(uri: string) {
  workflowTemplateCache.delete(uri);
}