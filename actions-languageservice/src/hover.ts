import {convertWorkflowTemplate, parseWorkflow, ParseWorkflowResult} from "@github/actions-workflow-parser";
import {ErrorPolicy} from "@github/actions-workflow-parser/model/convert";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {TokenResult} from "./utils/find-token";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {isString} from "@github/actions-workflow-parser/templates/tokens/type-guards";
import {StringToken} from "@github/actions-workflow-parser/templates/tokens/string-token";
import {Position, TextDocument} from "vscode-languageserver-textdocument";
import {Hover} from "vscode-languageserver-types";
import {getWorkflowContext, WorkflowContext} from "./context/workflow-context";
import {info} from "./log";
import {nullTrace} from "./nulltrace";
import {findToken} from "./utils/find-token";
import {mapRange} from "./utils/range";
import {getSentence} from "@github/actions-workflow-parser/model/converter/cron";

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

  const tokenResult = findToken(position, result.value);
  const token = tokenResult.token;
  if (!token?.definition) {
    return null;
  }

  info(`Calculating hover for token with definition ${token.definition.key}`);

  if (tokenResult.parent && isCronMappingValue(tokenResult)) {
    const tokenValue = (token as StringToken).value
    let description = getSentence(tokenValue);
    if (description) {
      description +=
        "\n\nActions schedules run at most every 5 minutes." +
        " [Learn more](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#onschedule)";
      return {
        contents: description,
        range: mapRange(token.range)
      } as Hover;
    }
    return {
      contents: "Invalid cron expression",
      range: mapRange(token.range)
    } as Hover;
  }

  let description = await getDescription(document, config, result, token, tokenResult.path);

  if (token.definition.evaluatorContext.length > 0) {
    // Only add padding if there is a description
    description += `${description.length > 0 ? `\n\n` : ""}**Context:** ${token.definition.evaluatorContext.join(
      ", "
    )}`;
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

function isCronMappingValue(tokenResult: TokenResult): boolean {
  return tokenResult.parent?.definition?.key === "cron-mapping" && 
    (tokenResult.token as StringToken).value !== "cron" && 
    isString(tokenResult.token!);
}
