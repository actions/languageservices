import {parseWorkflow} from "@github/actions-workflow-parser";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/template-token";
import {MappingToken} from "@github/actions-workflow-parser/templates/tokens/mapping-token";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {Position, TextDocument} from "vscode-languageserver-textdocument";
import {Hover} from "vscode-languageserver-types";
import {nullTrace} from "./nulltrace";
import {findInnerToken, findToken} from "./utils/find-token";
import {TokenType} from "@github/actions-workflow-parser/templates/tokens/types";

// Render value description and Context when hovering over a key in a MappingToken
export async function hover(document: TextDocument, position: Position): Promise<Hover | null> {
  const file: File = {
    name: document.uri,
    content: document.getText()
  };
  const result = parseWorkflow(file.name, [file], nullTrace);

  const {token, keyToken, parent} = findToken(position, result.value);

  if (result.value && token) {
    // If the parent is a MappingToken and no keyToken was returned, our token is the key
    if (parent?.templateTokenType === TokenType.Mapping && !keyToken) {
      const mappingToken = parent as MappingToken;
      const value = mappingToken.find(token.toString());
      if (value) {
        return getHover(token, value);
      }
    }
  }
  return null;
}

// PositionToken is the token that the cursor is on
// DescriptionToken may differ if the description is stored on an associated token, such as when hovering over a key in a mapping
function getHover(positionToken: TemplateToken, descriptionToken: TemplateToken): Hover | null {
  if (descriptionToken.definition) {
    let description = "";
    if (descriptionToken.description) {
      description = descriptionToken.description;
    }

    if (descriptionToken.definition.evaluatorContext.length > 0) {
      // Only add padding if there is a description
      description += `${
        description.length > 0 ? `\n\n` : ""
      }**Context:** ${descriptionToken.definition.evaluatorContext.join(", ")}`;
    }

    return {
      contents: description,
      range: {
        start: {
          line: positionToken.range!.start[0] - 1,
          character: positionToken.range!.start[1] - 1
        },
        end: {
          line: positionToken.range!.end[0] - 1,
          character: positionToken.range!.end[1] - 1
        }
      }
    } as Hover;
  }
  return null;
}
