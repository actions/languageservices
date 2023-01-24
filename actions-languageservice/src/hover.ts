import {convertWorkflowTemplate, parseWorkflow, ParseWorkflowResult} from "@github/actions-workflow-parser";
import {ErrorPolicy} from "@github/actions-workflow-parser/model/convert";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {Position, TextDocument} from "vscode-languageserver-textdocument";
import {Hover} from "vscode-languageserver-types";
import {getWorkflowContext, WorkflowContext} from "./context/workflow-context";
import {info} from "./log";
import {nullTrace} from "./nulltrace";
import {findToken} from "./utils/find-token";
import {mapRange} from "./utils/range";

export type DescriptionProvider = {
  getDescription(context: WorkflowContext, token: TemplateToken, path: TemplateToken[]): Promise<string | undefined>;
};

export type HoverConfig = {
  descriptionProvider?: DescriptionProvider;
};

// Render value description and Context when hovering over a key in a MappingToken
export async function hover(document: TextDocument, position: Position, config?: HoverConfig): Promise<Hover | null> {
  const file: File = {
    name: document.uri,
    content: document.getText()
  };
  const result = parseWorkflow(file.name, [file], nullTrace);

  const {token, path} = findToken(position, result.value);
  if (!token?.definition) {
    return null;
  }

  info(`Calculating hover for token with definition ${token.definition.key}`);

  let description = await getDescription(document, config, result, token, path);

  const allowedContext = token.definitionInfo?.allowedContext;
  if (allowedContext && allowedContext?.length > 0) {
    // Only add padding if there is a description
    description += `${description.length > 0 ? `\n\n` : ""}**Context:** ${allowedContext.join(", ")}`;
  }

  return {
    contents: description,
    range: mapRange(token.range)
  } satisfies Hover;
}

async function getDescription(
  document: TextDocument,
  config: HoverConfig | undefined,
  result: ParseWorkflowResult | undefined,
  token: TemplateToken,
  path: TemplateToken[]
) {
  const defaultDescription = token.description || "";
  if (!result?.value || !config?.descriptionProvider) {
    return defaultDescription;
  }

  const template = convertWorkflowTemplate(result.context, result.value, ErrorPolicy.TryConversion);
  const workflowContext = getWorkflowContext(document.uri, template, path);
  const description = await config.descriptionProvider.getDescription(workflowContext, token, path);
  return description || defaultDescription;
}
