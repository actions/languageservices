import {parseWorkflow} from "@github/actions-workflow-parser";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {TokenResult} from "./utils/find-token";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {isString} from "@github/actions-workflow-parser/templates/tokens/type-guards";
import {StringToken} from "@github/actions-workflow-parser/templates/tokens/string-token";
import {Position, TextDocument} from "vscode-languageserver-textdocument";
import {Hover} from "vscode-languageserver-types";
import {info} from "./log";
import {nullTrace} from "./nulltrace";
import {findToken} from "./utils/find-token";
import {mapRange} from "./utils/range";
import {getSentence} from "@github/actions-workflow-parser/model/converter/cron";

// Render value description and Context when hovering over a key in a MappingToken
export async function hover(document: TextDocument, position: Position): Promise<Hover | null> {
  const file: File = {
    name: document.uri,
    content: document.getText()
  };
  const result = parseWorkflow(file.name, [file], nullTrace);

  const tokenResult = findToken(position, result.value);

  if (result.value) {
    return getHover(tokenResult);
  }
  return null;
}

function getHover(tokenResult: TokenResult): Hover | null {
  const token = tokenResult.token;
  if (!token) {
    return null;
  }
  if (tokenResult.parent && isCronMapping(tokenResult.parent) && isString(token)) {
    let description = getSentence((token as StringToken).value);
    if (description) {
      description += "\n\nActions schedules run at most every 5 minutes." +
        " [Learn more](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#onschedule)"
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
  if (token.definition) {
    info(`Calculating hover for token with definition ${token.definition.key}`);

    let description = "";
    if (token.description) {
      description = token.description;
    }

    if (token.definition.evaluatorContext.length > 0) {
      // Only add padding if there is a description
      description += `${description.length > 0 ? `\n\n` : ""}**Context:** ${token.definition.evaluatorContext.join(
        ", "
      )}`;
    }

    return {
      contents: description,
      range: mapRange(token.range)
    } as Hover;
  }
  return null;
}

function isCronMapping(token: TemplateToken): boolean {
  return token.definition?.key === "cron-mapping"
}