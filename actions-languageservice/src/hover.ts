import {
  parseWorkflow,
  ParseWorkflowResult,
} from "@github/actions-workflow-parser";
import { TemplateToken } from "@github/actions-workflow-parser/templates/tokens/template-token";
import { MappingToken } from "@github/actions-workflow-parser/templates/tokens/mapping-token";
import { SequenceToken } from "@github/actions-workflow-parser/templates/tokens/sequence-token";
import { File } from "@github/actions-workflow-parser/workflows/file";
import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { Hover } from "vscode-languageserver-types";
import { nullTrace } from "./nulltrace";
import { findInnerToken } from "./utils/find-token";

export async function hover(
  document: TextDocument,
  position: Position
): Promise<Hover | null> {
  const file: File = {
    name: document.uri,
    content: document.getText(),
  };
  const result = parseWorkflow(file.name, [file], nullTrace);

  // Find inner token returns null if position is not in a token
  const innerToken = findInnerToken(position, result.value);
  if (result.value && innerToken) {
    return getHover(innerToken);
  }
  return null;
}

function getHover(innerToken: TemplateToken): Hover | null {
  if (innerToken.definition) {
    let description = "";
    if (innerToken.description) {
      description = innerToken.description;
    }

    if (innerToken.definition.evaluatorContext.length > 0) {
      // Only add padding if there is a description
      description += `${description.length > 0 ? `\n\n` : ""}**Context:** ${
        innerToken.definition.evaluatorContext.join(", ")
      }`;
    }

    return {
      contents: description,
      range: {
        start: {
          line: innerToken.range!.start[0],
          character: innerToken.range!.start[1],
        },
        end: {
          line: innerToken.range!.end[0],
          character: innerToken.range!.end[1],
        },
      },
    } as Hover;
  }
  return null;
}
