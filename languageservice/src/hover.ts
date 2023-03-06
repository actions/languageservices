import {DescriptionDictionary, Parser} from "@github/actions-expressions";
import {FunctionInfo} from "@github/actions-expressions/funcs/info";
import {Lexer} from "@github/actions-expressions/lexer";
import {ErrorPolicy} from "@github/actions-workflow-parser/model/convert";
import {getCronDescription} from "@github/actions-workflow-parser/model/converter/cron";
import {splitAllowedContext} from "@github/actions-workflow-parser/templates/allowed-context";
import {StringToken} from "@github/actions-workflow-parser/templates/tokens/string-token";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {isBasicExpression, isString} from "@github/actions-workflow-parser/templates/tokens/type-guards";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {FileProvider} from "@github/actions-workflow-parser/workflows/file-provider";
import {Position, TextDocument} from "vscode-languageserver-textdocument";
import {Hover} from "vscode-languageserver-types";
import {ContextProviderConfig} from "./context-providers/config";
import {getContext, Mode} from "./context-providers/default";
import {getWorkflowContext, WorkflowContext} from "./context/workflow-context";
import {
  isReusableWorkflowJobInput,
  getReusableWorkflowInputDescription
} from "./description-providers/reusable-job-inputs";
import {ExpressionPos, mapToExpressionPos} from "./expression-hover/expression-pos";
import {HoverVisitor} from "./expression-hover/visitor";
import {validatorFunctions} from "./expression-validation/functions";
import {info} from "./log";
import {isPotentiallyExpression} from "./utils/expression-detection";
import {findToken, TokenResult} from "./utils/find-token";
import {mapRange} from "./utils/range";
import {fetchOrParseWorkflow, fetchOrConvertWorkflowTemplate} from "./utils/workflow-cache";

export type HoverConfig = {
  descriptionProvider?: DescriptionProvider;
  contextProviderConfig?: ContextProviderConfig;
  fileProvider?: FileProvider;
};

export type DescriptionProvider = {
  getDescription(context: WorkflowContext, token: TemplateToken, path: TemplateToken[]): Promise<string | undefined>;
};

export async function hover(document: TextDocument, position: Position, config?: HoverConfig): Promise<Hover | null> {
  const file: File = {
    name: document.uri,
    content: document.getText()
  };

  const parsedWorkflow = fetchOrParseWorkflow(file, document.uri);
  if (!parsedWorkflow) {
    return null;
  }

  const template = await fetchOrConvertWorkflowTemplate(parsedWorkflow, document.uri, config, {
    errorPolicy: ErrorPolicy.TryConversion,
    fetchReusableWorkflowDepth: config?.fileProvider ? 1 : 0
  });

  const tokenResult = findToken(position, parsedWorkflow.value);
  const {token, keyToken, parent} = tokenResult;
  const tokenDefinitionInfo = (keyToken || parent || token)?.definitionInfo;

  const workflowContext = getWorkflowContext(document.uri, template, tokenResult.path);
  if (token && tokenDefinitionInfo) {
    if (isBasicExpression(token) || isPotentiallyExpression(token)) {
      info(`Calculating expression hover for token with definition ${tokenDefinitionInfo.definition.key}`);

      const allowedContext = tokenDefinitionInfo.allowedContext || [];
      const {namedContexts, functions} = splitAllowedContext(allowedContext);
      const context = await getContext(namedContexts, config?.contextProviderConfig, workflowContext, Mode.Completion);

      const exprPos = mapToExpressionPos(token, position);
      if (exprPos) {
        return expressionHover(exprPos, context, namedContexts, functions);
      }
    }
  }

  if (!token?.definition) {
    return null;
  }

  info(`Calculating hover for token with definition ${token.definition.key}`);

  if (tokenResult.parent && isCronMappingValue(tokenResult)) {
    const tokenValue = (token as StringToken).value;
    const description = getCronDescription(tokenValue);
    if (description) {
      return {
        contents: description,
        range: mapRange(token.range)
      } satisfies Hover;
    }
  }

  if (tokenResult.parent && isReusableWorkflowJobInput(tokenResult)) {
    let description = getReusableWorkflowInputDescription(workflowContext, tokenResult);
    description = appendContext(description, token.definitionInfo?.allowedContext);
    return {
      contents: description,
      range: mapRange(token.range)
    } satisfies Hover;
  }

  let description = await getDescription(config, workflowContext, token, tokenResult.path);
  description = appendContext(description, token.definitionInfo?.allowedContext);

  return {
    contents: description,
    range: mapRange(token.range)
  } satisfies Hover;
}

function appendContext(description: string, allowedContext?: string[]) {
  if (allowedContext && allowedContext?.length > 0) {
    // Only add padding if there is a description
    description += `${description.length > 0 ? `\n\n` : ""}**Context:** ${allowedContext.join(", ")}`;
  }
  return description;
}

async function getDescription(
  config: HoverConfig | undefined,
  workflowContext: WorkflowContext,
  token: TemplateToken,
  path: TemplateToken[]
) {
  const defaultDescription = token.description || "";
  if (!config?.descriptionProvider) {
    return defaultDescription;
  }

  const description = await config.descriptionProvider.getDescription(workflowContext, token, path);
  return description || defaultDescription;
}

function isCronMappingValue(tokenResult: TokenResult): boolean {
  return (
    tokenResult.parent?.definition?.key === "cron-mapping" &&
    isString(tokenResult.token!) &&
    tokenResult.token.value !== "cron"
  );
}

function expressionHover(
  exprPos: ExpressionPos,
  context: DescriptionDictionary,
  namedContexts: string[],
  functions: FunctionInfo[]
): Hover | null {
  const {expression, position, documentRange} = exprPos;

  try {
    const l = new Lexer(expression);
    const lr = l.lex();

    const p = new Parser(lr.tokens, namedContexts, functions);
    const expr = p.parse();

    const hv = new HoverVisitor(position, context, [], validatorFunctions);
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
    info(`Encountered error trying to calculate expression hover: ${e}`);
    return null;
  }
}
