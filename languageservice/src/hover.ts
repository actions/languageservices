import {data, DescriptionDictionary, Parser} from "@actions/expressions";
import {FunctionDefinition, FunctionInfo} from "@actions/expressions/funcs/info";
import {Lexer} from "@actions/expressions/lexer";
import {parseAction} from "@actions/workflow-parser/actions/action-parser";
import {isString} from "@actions/workflow-parser";
import {getCronDescription} from "@actions/workflow-parser/model/converter/cron";
import {ErrorPolicy} from "@actions/workflow-parser/model/convert";
import {splitAllowedContext} from "@actions/workflow-parser/templates/allowed-context";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";
import {isBasicExpression} from "@actions/workflow-parser/templates/tokens/type-guards";
import {File} from "@actions/workflow-parser/workflows/file";
import {FileProvider} from "@actions/workflow-parser/workflows/file-provider";
import {Position, TextDocument} from "vscode-languageserver-textdocument";
import {Hover} from "vscode-languageserver-types";
import {ContextProviderConfig} from "./context-providers/config.js";
import {getActionExpressionContext, getWorkflowExpressionContext, Mode} from "./context-providers/default.js";
import {getFunctionDescription} from "./context-providers/descriptions.js";
import {ActionContext, getActionContext} from "./context/action-context.js";
import {getWorkflowContext, WorkflowContext} from "./context/workflow-context.js";
import {
  getReusableWorkflowInputDescription,
  isReusableWorkflowJobInput
} from "./description-providers/reusable-job-inputs.js";
import {ExpressionPos, mapToExpressionPos} from "./expression-hover/expression-pos.js";
import {HoverVisitor} from "./expression-hover/visitor.js";
import {info} from "./log.js";
import {nullTrace} from "./nulltrace.js";
import {isActionDocument} from "./utils/document-type.js";
import {isPotentiallyExpression} from "./utils/expression-detection.js";
import {findToken} from "./utils/find-token.js";
import {mapRange} from "./utils/range.js";
import {getOrConvertActionTemplate, getOrConvertWorkflowTemplate, getOrParseWorkflow} from "./utils/workflow-cache.js";

export type HoverConfig = {
  descriptionProvider?: DescriptionProvider;
  contextProviderConfig?: ContextProviderConfig;
  fileProvider?: FileProvider;
};

export type DescriptionProvider = {
  getDescription(
    context: WorkflowContext | ActionContext,
    token: TemplateToken,
    path: TemplateToken[]
  ): Promise<string | undefined>;
};

/**
 * Returns hover information for the token at the given position.
 */
export async function hover(document: TextDocument, position: Position, config?: HoverConfig): Promise<Hover | null> {
  const file: File = {
    name: document.uri,
    content: document.getText()
  };

  // Determine document type based on file path (action.yml vs workflow file)
  const isAction = isActionDocument(document.uri);

  // Parse document
  const parsedTemplate = isAction ? parseAction(file, nullTrace) : getOrParseWorkflow(file, document.uri);
  if (!parsedTemplate?.value) {
    return null;
  }

  // Find the token at the cursor position
  const tokenResult = findToken(position, parsedTemplate.value);
  const {token, keyToken, parent} = tokenResult;
  const tokenDefinitionInfo = (keyToken || parent || token)?.definitionInfo;

  // Early exit if there's nothing to provide hover for
  const hoverToken = token || keyToken;
  const isExpressionHover =
    token && tokenDefinitionInfo && (isBasicExpression(token) || isPotentiallyExpression(token, isAction));
  if (!isExpressionHover && !hoverToken?.definition) {
    return null;
  }

  // Build document context (jobs, steps, inputs, etc.) from the parsed template
  const documentContext = isAction
    ? getActionContext(
        document.uri,
        getOrConvertActionTemplate(parsedTemplate.context, parsedTemplate.value, document.uri, {
          errorPolicy: ErrorPolicy.TryConversion
        }),
        tokenResult.path
      )
    : getWorkflowContext(
        document.uri,
        await getOrConvertWorkflowTemplate(parsedTemplate.context, parsedTemplate.value, document.uri, config, {
          errorPolicy: ErrorPolicy.TryConversion,
          fetchReusableWorkflowDepth: config?.fileProvider ? 1 : 0
        }),
        tokenResult.path
      );

  // Expression hover
  if (isExpressionHover) {
    info(`Calculating expression hover for token with definition ${tokenDefinitionInfo.definition.key}`);

    const allowedContext = tokenDefinitionInfo.allowedContext || [];
    const {namedContexts, functions} = splitAllowedContext(allowedContext);

    // Build expression context with named contexts (github, env, etc.) and their descriptions
    const expressionContext = isAction
      ? getActionExpressionContext(
          namedContexts,
          config?.contextProviderConfig,
          documentContext as ActionContext,
          Mode.Hover
        )
      : await getWorkflowExpressionContext(
          namedContexts,
          config?.contextProviderConfig,
          documentContext as WorkflowContext,
          Mode.Hover
        );

    // Populate function descriptions for hover display
    for (const func of functions) {
      func.description = getFunctionDescription(func.name);
    }

    // Convert document position to expression-relative position
    const exprPos = mapToExpressionPos(token, position);
    if (exprPos) {
      // Find the expression element at the cursor and return its description
      return expressionHover(exprPos, expressionContext, namedContexts, functions);
    }
  }

  if (!hoverToken?.definition) {
    return null;
  }

  // Non-expression hover: show the schema description for the YAML key or value
  info(`Calculating hover for token with definition ${hoverToken.definition.key}`);

  // Check for cron expression hover
  if (isString(hoverToken) && hoverToken.definition.key === "cron-pattern") {
    const cronDescription = getCronDescription(hoverToken.value);
    if (cronDescription) {
      return {
        contents: cronDescription,
        range: mapRange(hoverToken.range)
      };
    }
  }

  let description: string;
  if (!isAction && tokenResult.parent && isReusableWorkflowJobInput(tokenResult)) {
    // Reusable workflow call: fetch the called workflow's input descriptions
    description = getReusableWorkflowInputDescription(documentContext as WorkflowContext, tokenResult);
  } else {
    // Default: use custom provider or token's schema description
    description =
      (await getDescription(config, documentContext, hoverToken, tokenResult.path)) || hoverToken.description || "";
  }

  // Return hover with description and available expression contexts
  return {
    contents: appendContext(description, hoverToken.definitionInfo?.allowedContext),
    range: mapRange(hoverToken.range)
  } satisfies Hover;
}

/**
 * Appends available expression contexts and functions to a hover description.
 * For example: "Available expression contexts: `github`, `env`"
 */
function appendContext(description: string, allowedContext?: string[]) {
  if (!allowedContext || allowedContext.length == 0) {
    return description;
  }
  const {namedContexts, functions} = splitAllowedContext(allowedContext);
  let namedContextsString = "";
  let functionsString = "";

  if (namedContexts.length > 0) {
    namedContextsString = `${description.length > 0 ? `\n\n` : ""}Available expression contexts: ${namedContexts
      .map(x => `\`${x}\``)
      .join(", ")}`;
  }
  if (functions.length > 0) {
    functionsString = `${namedContexts.length > 0 ? `\n\n` : ""}Available expression functions: ${functions
      .map(x => x.name)
      .map(x => `\`${x}\``)
      .join(", ")}`;
  }

  return `${description}${namedContextsString}${functionsString}`;
}

/**
 * Gets a custom description from the configured description provider.
 * Used to fetch rich descriptions like action input docs from GitHub repos.
 */
async function getDescription(
  config: HoverConfig | undefined,
  documentContext: WorkflowContext | ActionContext,
  token: TemplateToken,
  path: TemplateToken[]
): Promise<string | undefined> {
  if (!config?.descriptionProvider) {
    return undefined;
  }

  return await config.descriptionProvider.getDescription(documentContext, token, path);
}

/**
 * Parses an expression and finds the element at the cursor position to show its description.
 * For example, hovering over `github.actor` shows "The login of the user that triggered the workflow".
 */
function expressionHover(
  exprPos: ExpressionPos,
  expressionContext: DescriptionDictionary,
  namedContexts: string[],
  functions: FunctionInfo[]
): Hover | null {
  const {expression, position, documentRange} = exprPos;

  try {
    const l = new Lexer(expression);
    const lr = l.lex();

    const p = new Parser(lr.tokens, namedContexts, functions);
    const expr = p.parse();

    const functionMap = new Map<string, FunctionDefinition>();
    for (const func of functions) {
      functionMap.set(func.name.toLowerCase(), {
        ...func,
        call: () => new data.Null()
      });
    }
    const hv = new HoverVisitor(position, expressionContext, functionMap);
    const hoverResult = hv.hover(expr);
    if (!hoverResult) {
      return null;
    }

    const exprRange = hoverResult.range;

    return {
      contents: hoverResult?.description || hoverResult?.label,
      // Map the expression range back to a document range
      range: {
        start: {
          line: documentRange.start.line + exprRange.start.line,
          character: documentRange.start.character + exprRange.start.column
        },
        end: {
          line: documentRange.start.line + exprRange.end.line,
          character: documentRange.start.character + exprRange.end.column
        }
      }
    };
  } catch (e) {
    // Hovering over an invalid expression should not cause an error here
    info(`Encountered error trying to calculate expression hover: ${(e as Error).message}`);
    return null;
  }
}
