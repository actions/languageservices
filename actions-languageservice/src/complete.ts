import {complete as completeExpression, data} from "@github/actions-expressions";
import {isSequence, isString, parseWorkflow} from "@github/actions-workflow-parser";
import {CLOSE_EXPRESSION, OPEN_EXPRESSION} from "@github/actions-workflow-parser/templates/template-constants";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/index";
import {MappingToken} from "@github/actions-workflow-parser/templates/tokens/mapping-token";
import {SequenceToken} from "@github/actions-workflow-parser/templates/tokens/sequence-token";
import {TokenType} from "@github/actions-workflow-parser/templates/tokens/types";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {Position, TextDocument} from "vscode-languageserver-textdocument";
import {CompletionItem} from "vscode-languageserver-types";
import {ContextProviderConfig} from "./context-providers/config";
import {nullTrace} from "./nulltrace";
import {findInnerTokenAndParent} from "./utils/find-token";
import {transform} from "./utils/transform";
import {Value, ValueProviderConfig} from "./value-providers/config";
import {defaultValueProviders} from "./value-providers/default";

export function getExpressionInput(input: string, pos: number): string | undefined {
  // Find start marker around the cursor position
  const startPos = input.lastIndexOf(OPEN_EXPRESSION, pos);
  if (startPos === -1) {
    return undefined;
  }

  // Find end marker after the cursor position
  let endPos = input.indexOf(CLOSE_EXPRESSION, pos);
  if (endPos === -1) {
    // Assume an unfinished expression like "${{ someinput.|"
    endPos = input.length;
  }

  return input.substring(startPos + OPEN_EXPRESSION.length, endPos);
}

export async function complete(
  textDocument: TextDocument,
  position: Position,
  valueProviderConfig?: ValueProviderConfig,
  contextProviderConfig?: ContextProviderConfig
): Promise<CompletionItem[]> {
  // Fix the input to work around YAML parsing issues
  const [newDoc, newPos] = transform(textDocument, position);

  const file: File = {
    name: textDocument.uri,
    content: newDoc.getText()
  };
  const result = parseWorkflow(file.name, [file], nullTrace);

  const [innerToken, parent] = findInnerTokenAndParent(newPos, result.value);

  // If we are inside an expression, take a different code-path. The workflow parser does not correctly create
  // expression nodes for invalid expressions and during editing expressions are invalid most of the time.
  if (innerToken && isString(innerToken) && innerToken.value.indexOf(OPEN_EXPRESSION) >= 0) {
    // TODO: Handle expressions without markers like `if`

    const currentInput = innerToken.value;

    // Transform the overall position into a node relative position
    const relCharPos = newPos.character - innerToken.range!.start[1];

    const expressionInput = (getExpressionInput(currentInput, relCharPos) || "").trim();

    const context =
      (await contextProviderConfig?.getContext(innerToken.definition!.readerContext)) || new data.Dictionary();

    return completeExpression(expressionInput, context, []);
  }

  const values = await getValues(innerToken, parent, newPos, textDocument.uri, valueProviderConfig);
  return values.map(value => CompletionItem.create(value.label));
}

async function getValues(
  token: TemplateToken | null,
  parent: TemplateToken | null,
  position: Position,
  workflowUri: string,
  valueProviderConfig: ValueProviderConfig | undefined
): Promise<Value[]> {
  if (!parent) {
    return [];
  }

  if (token?.templateTokenType === TokenType.Null) {
    // Ensure there's a space after the parent key
    if (parent.range && position.character + 1 === parent.range.end[1]) {
      return [];
    }
  }

  const existingValues = getExistingValues(token, parent);

  let customValues: Value[] | undefined = undefined;
  if (token?.definition?.key) {
    customValues = await valueProviderConfig?.getCustomValues(token.definition.key, {uri: workflowUri});
  }

  if (customValues !== undefined) {
    return filterAndSortCompletionOptions(customValues, existingValues);
  }

  const valueProviders = defaultValueProviders();

  // Use the key from the parent if we don't have a value provider for the current key
  // Ideally each token would have a valid key
  const valueProvider =
    (token?.definition?.key && valueProviders[token.definition.key]) ||
    (parent?.definition?.key && valueProviders[parent.definition.key]);
  if (!valueProvider) {
    return [];
  }
  const values = valueProvider();

  return filterAndSortCompletionOptions(values, existingValues);
}

function getExistingValues(token: TemplateToken | null, parent: TemplateToken) {
  // For incomplete YAML, we may only have a parent token
  if (token) {
    if (!isString(token) || !isSequence(parent)) {
      return;
    }

    const sequenceValues = new Set<string>();
    const seqToken = parent as SequenceToken;
    for (let i = 0; i < seqToken.count; i++) {
      const t = seqToken.get(i);
      if (t.isLiteral && isString(t)) {
        // Should we support other literal values here?
        sequenceValues.add(t.value);
      }
    }
    return sequenceValues;
  }

  if (parent.templateTokenType === TokenType.Mapping) {
    // No token and parent is a mapping, so we're completing a key
    const mapKeys = new Set<string>();
    const mapToken = parent as MappingToken;
    for (let i = 0; i < mapToken.count; i++) {
      const key = mapToken.get(i).key;
      if (key.isLiteral && isString(key)) {
        mapKeys.add(key.value);
      }
    }

    return mapKeys;
  }
}

function filterAndSortCompletionOptions(options: Value[], existingValues?: Set<string>) {
  options = options.filter(x => !existingValues || !existingValues.has(x.label));
  options.sort((a, b) => a.label.localeCompare(b.label));
  return options;
}
