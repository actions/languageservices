import {complete as completeExpression} from "@github/actions-expressions";
import {convertWorkflowTemplate, isSequence, isString, parseWorkflow} from "@github/actions-workflow-parser";
import {CLOSE_EXPRESSION, OPEN_EXPRESSION} from "@github/actions-workflow-parser/templates/template-constants";
import {TemplateToken} from "@github/actions-workflow-parser/templates/tokens/index";
import {MappingToken} from "@github/actions-workflow-parser/templates/tokens/mapping-token";
import {TokenType} from "@github/actions-workflow-parser/templates/tokens/types";
import {File} from "@github/actions-workflow-parser/workflows/file";
import {Position, TextDocument} from "vscode-languageserver-textdocument";
import {CompletionItem} from "vscode-languageserver-types";
import {ContextProviderConfig} from "./context-providers/config";
import {getContext} from "./context-providers/default";
import {getWorkflowContext, WorkflowContext} from "./context/workflow-context";
import {nullTrace} from "./nulltrace";
import {findToken} from "./utils/find-token";
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
  const template = convertWorkflowTemplate(result.context, result.value);

  // If we are inside an expression, take a different code-path. The workflow parser does not correctly create
  // expression nodes for invalid expressions and during editing expressions are invalid most of the time.
  if (token) {
    // We don't have any way of specifying that a token in the workflow schema is alwyas an expression. For now these
    // are only the job and step level `if` nodes, so check for those here.
    const isIfKey = keyToken && isString(keyToken) && keyToken.value === "if";
    const containsExpression = isString(token) && token.value.indexOf(OPEN_EXPRESSION) >= 0;
    if (isString(token) && (isIfKey || containsExpression)) {
      const currentInput = token.value;

      // Transform the overall position into a node relative position
      const relCharPos = newPos.character - token.range!.start[1];

      const expressionInput = (getExpressionInput(currentInput, relCharPos) || "").trim();

      const context = getContext(token.definition?.readerContext || [], contextProviderConfig);

      return completeExpression(expressionInput, context, []);
    }
  }

  const workflowContext = getWorkflowContext(textDocument.uri, template, path);
  const values = await getValues(token, parent, valueProviderConfig, workflowContext);
  return values.map(value => CompletionItem.create(value.label));
}

async function getValues(
  token: TemplateToken | null,
  parent: TemplateToken | null,
  valueProviderConfig: ValueProviderConfig | undefined,
  workflowContext: WorkflowContext
): Promise<Value[]> {
  if (!parent) {
    return [];
  }

  const existingValues = getExistingValues(token, parent);

  if (token?.definition?.key) {
    const customValues = await valueProviderConfig?.getCustomValues(token.definition.key, workflowContext);

    if (customValues) {
      return filterAndSortCompletionOptions(customValues, existingValues);
    }
  }

  // Use the value provider from the parent if we don't have a value provider for the current key
  const valueProvider =
    (token?.definition?.key && defaultValueProviders[token.definition.key]) ||
    (parent.definition?.key && defaultValueProviders[parent.definition.key]);

  if (valueProvider) {
    const values = valueProvider(workflowContext);
    return filterAndSortCompletionOptions(values, existingValues);
  }

  // Use the definition if there are no value providers
  const def = token?.definition || parent.definition;
  if (!def) {
    return [];
  }

  const values = definitionValues(def);
  return filterAndSortCompletionOptions(values, existingValues);
}

function getExistingValues(token: TemplateToken | null, parent: TemplateToken) {
  // For incomplete YAML, we may only have a parent token
  if (token) {
    if (!isString(token)) {
      return;
    }

    if (isSequence(parent)) {
      const sequenceValues = new Set<string>();

      for (let i = 0; i < parent.count; i++) {
        const t = parent.get(i);
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

    for (let i = 0; i < mapToken.count; i++) {
      const key = mapToken.get(i).key;

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
