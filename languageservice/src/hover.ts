import {data, DescriptionDictionary, Parser} from "@actions/expressions";
import {FunctionDefinition, FunctionInfo} from "@actions/expressions/funcs/info";
import {Lexer} from "@actions/expressions/lexer";
import {ErrorPolicy} from "@actions/workflow-parser/model/convert";
import {splitAllowedContext} from "@actions/workflow-parser/templates/allowed-context";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";
import {isBasicExpression} from "@actions/workflow-parser/templates/tokens/type-guards";
import {File} from "@actions/workflow-parser/workflows/file";
import {FileProvider} from "@actions/workflow-parser/workflows/file-provider";
import {Position, TextDocument} from "vscode-languageserver-textdocument";
import {Hover} from "vscode-languageserver-types";
import {ContextProviderConfig} from "./context-providers/config";
import {getContext, Mode} from "./context-providers/default";
import {getFunctionDescription} from "./context-providers/descriptions";
import {getWorkflowContext, WorkflowContext} from "./context/workflow-context";
import {
  getReusableWorkflowInputDescription,
  isReusableWorkflowJobInput
} from "./description-providers/reusable-job-inputs";
import {ExpressionPos, mapToExpressionPos} from "./expression-hover/expression-pos";
import {HoverVisitor} from "./expression-hover/visitor";
import {info} from "./log";
import {isPotentiallyExpression} from "./utils/expression-detection";
import {findToken} from "./utils/find-token";
import {mapRange} from "./utils/range";
import {fetchOrConvertWorkflowTemplate, fetchOrParseWorkflow} from "./utils/workflow-cache";

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
  if (!parsedWorkflow?.value) {
    return null;
  }

  const template = await fetchOrConvertWorkflowTemplate(
    parsedWorkflow.context,
    parsedWorkflow.value,
    document.uri,
    config,
    {
      errorPolicy: ErrorPolicy.TryConversion,
      fetchReusableWorkflowDepth: config?.fileProvider ? 1 : 0
    }
  );

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

      for (const func of functions) {
        func.description = getFunctionDescription(func.name);
      }

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

    const functionMap = new Map<string, FunctionDefinition>();
    for (const func of functions) {
      functionMap.set(func.name.toLowerCase(), {
        ...func,
        call: () => new data.Null()
      });
    }
    const hv = new HoverVisitor(position, context, functionMap);
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
