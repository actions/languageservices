import {parseWorkflow} from "@github/actions-workflow-parser";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {Position, TextDocument} from "vscode-languageserver-textdocument";
import {Hover} from "vscode-languageserver-types";
import {info} from "./log";
import {nullTrace} from "./nulltrace";
import {findToken} from "./utils/find-token";
import {mapRange} from "./utils/range";

// Render value description and Context when hovering over a key in a MappingToken
export async function hover(document: TextDocument, position: Position): Promise<Hover | null> {
  const file: File = {
    name: document.uri,
    content: document.getText()
  };
  const result = parseWorkflow(file.name, [file], nullTrace);

  const {token} = findToken(position, result.value);

  if (result.value && token) {
    return getHover(token);
  }
  return null;
}

function getHover(token: TemplateToken): Hover | null {
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
