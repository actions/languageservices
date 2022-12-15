import {complete as completeExpression} from "@github/actions-expressions";
import {convertWorkflowTemplate, isSequence, isString, parseWorkflow} from "@github/actions-workflow-parser";
import {ErrorPolicy} from "@github/actions-workflow-parser/model/convert";
import {DefinitionType} from "@github/actions-workflow-parser/templates/schema/definition-type";
import {StringDefinition} from "@github/actions-workflow-parser/templates/schema/string-definition";
import {OPEN_EXPRESSION} from "@github/actions-workflow-parser/templates/template-constants";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/index";
import {MappingToken} from "@github/actions-workflow-parser/templates/tokens/mapping-token";
import {TokenType} from "@github/actions-workflow-parser/templates/tokens/types";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {Position, TextDocument} from "vscode-languageserver-textdocument";
import {CompletionItem, CompletionItemTag, Range, TextEdit} from "vscode-languageserver-types";
import {ContextProviderConfig} from "./context-providers/config";
import {getContext, Mode} from "./context-providers/default";
import {getWorkflowContext, WorkflowContext} from "./context/workflow-context";
import {nullTrace} from "./nulltrace";
import {findToken} from "./utils/find-token";
import {mapRange} from "./utils/range";
import {transform} from "./utils/transform";
import {Value, ValueProviderConfig} from "./value-providers/config";
import {defaultValueProviders} from "./value-providers/default";
import {definitionValues} from "./value-providers/definition";

export function getExpressionInput(input: string, pos: number): string {
  // Find start marker around the cursor position
  const startPos = input.lastIndexOf(OPEN_EXPRESSION, pos);
  if (startPos === -1) {
    return input;
  }

  return input.substring(startPos + OPEN_EXPRESSION.length, pos);
}

export async function complete(
  textDocument: TextDocument,
  position: Position,
  valueProviderConfig?: ValueProviderConfig,
  contextProviderConfig?: ContextProviderConfig
): Promise<CompletionItem[]> {
  // Edge case: when completing a key like `foo:|`, do not calculate auto-completions
  const charBeforePos = textDocument.getText({
    start: {line: position.line, character: position.character - 1},
    end: {line: position.line, character: position.character}
  });
  if (charBeforePos === ":") {
    return [];
  }

  // Fix the input to work around YAML parsing issues
  const [newDoc, newPos] = transform(textDocument, position);

  const file: File = {
    name: textDocument.uri,
    content: newDoc.getText()
  };
  const result = parseWorkflow(file.name, [file], nullTrace);
  if (!result.value) {
    return [];
  }

  const {token, keyToken, parent, path} = findToken(newPos, result.value);
  const template = convertWorkflowTemplate(result.context, result.value, ErrorPolicy.TryConversion);
  const workflowContext = getWorkflowContext(textDocument.uri, template, path);

  // If we are inside an expression, take a different code-path. The workflow parser does not correctly create
  // expression nodes for invalid expressions and during editing expressions are invalid most of the time.
  if (token) {
    const isExpression =
      token.definition?.definitionType === DefinitionType.String && (token.definition as StringDefinition).isExpression;
    const containsExpression = isString(token) && token.value.indexOf(OPEN_EXPRESSION) >= 0;
    if (isString(token) && (isExpression || containsExpression)) {
      const currentInput = token.source || token.value;

      // Transform the overall position into a node relative position
      let relCharPos: number = 0;
      const lineDiff = newPos.line - token.range!.start[0];
      if (token.range!.start[0] !== token.range!.end[0]) {
        const lines = currentInput.split("\n");
        const linesBeforeCusor = lines.slice(0, lineDiff);
        relCharPos = linesBeforeCusor.join("\n").length + 1 + newPos.character;
      } else {
        relCharPos = newPos.character - token.range!.start[1] + 1;
      }

      const expressionInput = (getExpressionInput(currentInput, relCharPos) || "").trim();

      const allowedContext = token.definitionInfo?.allowedContext || [];
      const context = await getContext(allowedContext, contextProviderConfig, workflowContext, Mode.Completion);

      return completeExpression(expressionInput, context, []);
    }
  }

  const values = await getValues(token, keyToken, parent, valueProviderConfig, workflowContext);
  let replaceRange: Range | undefined;
  if (token?.range) {
    replaceRange = mapRange(token.range);
  }

  return values.map(value => {
    const item: CompletionItem = {
      label: value.label,
      detail: value.description,
      tags: value.deprecated ? [CompletionItemTag.Deprecated] : undefined,
      textEdit: replaceRange ? TextEdit.replace(replaceRange, value.label) : undefined
    };

    return item;
  });
}

async function getValues(
  token: TemplateToken | null,
  keyToken: TemplateToken | null,
  parent: TemplateToken | null,
  valueProviderConfig: ValueProviderConfig | undefined,
  workflowContext: WorkflowContext
): Promise<Value[]> {
  if (!parent) {
    return [];
  }

  const existingValues = getExistingValues(token, parent);

  // Use the value providers from the parent if the current key is null
  const valueProviderToken = keyToken || parent;

  const customValueProvider =
    valueProviderToken?.definition?.key && valueProviderConfig?.[valueProviderToken.definition.key];
  if (customValueProvider) {
    const customValues = await customValueProvider.get(workflowContext);
    if (customValues) {
      return filterAndSortCompletionOptions(customValues, existingValues);
    }
  }

  const defaultValueProvider =
    valueProviderToken?.definition?.key && defaultValueProviders[valueProviderToken.definition.key];
  if (defaultValueProvider) {
    const values = await defaultValueProvider.get(workflowContext);
    return filterAndSortCompletionOptions(values, existingValues);
  }

  // Use the definition if there are no value providers
  const def = keyToken?.definition || parent.definition;
  if (!def) {
    return [];
  }

  const values = definitionValues(def);
  return filterAndSortCompletionOptions(values, existingValues);
}

export function getExistingValues(token: TemplateToken | null, parent: TemplateToken) {
  // For incomplete YAML, we may only have a parent token
  if (token) {
    if (!isString(token)) {
      return;
    }

    if (isSequence(parent)) {
      const sequenceValues = new Set<string>();

      for (const t of parent) {
        if (isString(t)) {
          // Should we support other literal values here?
          sequenceValues.add(t.value);
        }
      }

      return sequenceValues;
    }
  }

  if (parent.templateTokenType === TokenType.Mapping) {
    // No token and parent is a mapping, so we're completing a key
    const mapKeys = new Set<string>();
    const mapToken = parent as MappingToken;

    for (const {key} of mapToken) {
      if (isString(key)) {
        mapKeys.add(key.value);
      }
    }

    return mapKeys;
  }
}

function filterAndSortCompletionOptions(options: Value[], existingValues?: Set<string>) {
  options = options.filter(x => !existingValues?.has(x.label));
  options.sort((a, b) => a.label.localeCompare(b.label));
  return options;
}
