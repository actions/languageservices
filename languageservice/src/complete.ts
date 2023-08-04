import {complete as completeExpression, DescriptionDictionary} from "@actions/expressions";
import {CompletionItem as ExpressionCompletionItem} from "@actions/expressions/completion";
import {isBasicExpression, isSequence, isString} from "@actions/workflow-parser";
import {ErrorPolicy} from "@actions/workflow-parser/model/convert";
import {OPEN_EXPRESSION} from "@actions/workflow-parser/templates/template-constants";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/index";
import {MappingToken} from "@actions/workflow-parser/templates/tokens/mapping-token";
import {TokenType} from "@actions/workflow-parser/templates/tokens/types";
import {File} from "@actions/workflow-parser/workflows/file";
import {FileProvider} from "@actions/workflow-parser/workflows/file-provider";
import {Position, TextDocument} from "vscode-languageserver-textdocument";
import {CompletionItem, CompletionItemKind, CompletionItemTag, Range, TextEdit} from "vscode-languageserver-types";
import {ContextProviderConfig} from "./context-providers/config";
import {getContext, Mode} from "./context-providers/default";
import {getWorkflowContext, WorkflowContext} from "./context/workflow-context";
import {validatorFunctions} from "./expression-validation/functions";
import {error} from "./log";
import {isPotentiallyExpression} from "./utils/expression-detection";
import {findToken} from "./utils/find-token";
import {guessIndentation} from "./utils/indentation-guesser";
import {mapRange} from "./utils/range";
import {getRelCharOffset} from "./utils/rel-char-pos";
import {isPlaceholder, transform} from "./utils/transform";
import {fetchOrConvertWorkflowTemplate, fetchOrParseWorkflow} from "./utils/workflow-cache";
import {Value, ValueProviderConfig} from "./value-providers/config";
import {defaultValueProviders} from "./value-providers/default";
import {DefinitionValueMode, definitionValues} from "./value-providers/definition";

export function getExpressionInput(input: string, pos: number): string {
  // Find start marker around the cursor position
  let startPos = input.lastIndexOf(OPEN_EXPRESSION, pos);
  if (startPos === -1) {
    startPos = 0;
  } else {
    startPos += OPEN_EXPRESSION.length;
  }

  return input.substring(startPos, pos);
}

export type CompletionConfig = {
  valueProviderConfig?: ValueProviderConfig;
  contextProviderConfig?: ContextProviderConfig;
  fileProvider?: FileProvider;
};

export async function complete(
  textDocument: TextDocument,
  position: Position,
  config?: CompletionConfig
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

  const parsedWorkflow = fetchOrParseWorkflow(file, textDocument.uri, true);
  if (!parsedWorkflow.value) {
    return [];
  }

  const template = await fetchOrConvertWorkflowTemplate(
    parsedWorkflow.context,
    parsedWorkflow.value,
    textDocument.uri,
    config,
    {
      fetchReusableWorkflowDepth: config?.fileProvider ? 1 : 0,
      errorPolicy: ErrorPolicy.TryConversion
    }
  );

  const {token, keyToken, parent, path} = findToken(newPos, parsedWorkflow.value);
  const workflowContext = getWorkflowContext(textDocument.uri, template, path);

  // If we are inside an expression, take a different code-path. The workflow parser does not correctly create
  // expression nodes for invalid expressions and during editing expressions are invalid most of the time.
  if (token) {
    if (isBasicExpression(token) || isPotentiallyExpression(token)) {
      const allowedContext = token.definitionInfo?.allowedContext || [];
      const context = await getContext(allowedContext, config?.contextProviderConfig, workflowContext, Mode.Completion);

      return getExpressionCompletionItems(token, context, newPos);
    }
  }

  const indentation = guessIndentation(newDoc, 2, true); // Use 2 spaces as default and most common for YAML
  const indentString = " ".repeat(indentation.tabSize);

  const values = await getValues(token, keyToken, parent, config?.valueProviderConfig, workflowContext, indentString);

  let replaceRange: Range | undefined;
  if (token?.range) {
    replaceRange = mapRange(token.range);
  } else if (!token) {
    // Not a valid token, create a range from the current position
    const line = newDoc.getText({start: {line: position.line, character: 0}, end: position});

    // Get the length of the current word
    const val = line.match(/[\w_-]*$/)?.[0].length || 0;
    // Check if we need to remove a trailing colon
    const charAfterPos = textDocument.getText({
      start: {line: position.line, character: position.character},
      end: {line: position.line, character: position.character + 1}
    });
    if (charAfterPos === ":") {
      replaceRange = Range.create(
        {line: position.line, character: position.character - val},
        {line: position.line, character: position.character + 1}
      );
    } else {
      replaceRange = Range.create({line: position.line, character: position.character - val}, position);
    }
  }

  return values.map(value => {
    const newText = value.insertText || value.label;

    const item: CompletionItem = {
      label: value.label,
      documentation: value.description && {
        kind: "markdown",
        value: value.description
      },
      tags: value.deprecated ? [CompletionItemTag.Deprecated] : undefined,
      textEdit: replaceRange ? TextEdit.replace(replaceRange, newText) : TextEdit.insert(position, newText)
    };

    return item;
  });
}

async function getValues(
  token: TemplateToken | null,
  keyToken: TemplateToken | null,
  parent: TemplateToken | null,
  valueProviderConfig: ValueProviderConfig | undefined,
  workflowContext: WorkflowContext,
  indentation: string
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
    const customValues = await customValueProvider.get(workflowContext, existingValues);
    if (customValues) {
      return filterAndSortCompletionOptions(customValues, existingValues);
    }
  }

  const defaultValueProvider =
    valueProviderToken?.definition?.key && defaultValueProviders[valueProviderToken.definition.key];
  if (defaultValueProvider) {
    const values = await defaultValueProvider.get(workflowContext, existingValues);
    return filterAndSortCompletionOptions(values, existingValues);
  }

  // Use the definition if there are no value providers
  const def = keyToken?.definition || parent.definition;
  if (!def) {
    return [];
  }

  const values = definitionValues(def, indentation, keyToken ? DefinitionValueMode.Key : DefinitionValueMode.Parent);
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

    for (const {key, value} of mapToken) {
      if (isString(key) && !isPlaceholder(key, value)) {
        mapKeys.add(key.value);
      }
    }

    return mapKeys;
  }
}

function getExpressionCompletionItems(
  token: TemplateToken,
  context: DescriptionDictionary,
  pos: Position
): CompletionItem[] {
  if (!token.range) {
    return [];
  }

  let currentInput = "";

  if (isBasicExpression(token)) {
    currentInput = token.source || token.expression;
  } else {
    const stringToken = token.assertString("Expected string token for expression completion");
    currentInput = stringToken.source || stringToken.value;
  }

  const relCharOffset = getRelCharOffset(token.range, currentInput, pos);
  const expressionInput = (getExpressionInput(currentInput, relCharOffset) || "").trim();

  try {
    return completeExpression(expressionInput, context, [], validatorFunctions).map(item =>
      mapExpressionCompletionItem(item, currentInput[relCharOffset])
    );
  } catch (e) {
    error(`Error while completing expression: '${(e as Error)?.message || "<no details>"}'`);
    return [];
  }
}

function filterAndSortCompletionOptions(options: Value[], existingValues?: Set<string>) {
  options = options.filter(x => !existingValues?.has(x.label));
  options.sort((a, b) => a.label.localeCompare(b.label));
  return options;
}

function mapExpressionCompletionItem(item: ExpressionCompletionItem, charAfterPos: string): CompletionItem {
  let insertText: string | undefined;
  // Insert parentheses if the cursor is after a function
  // and the function does not have any parantheses already
  if (item.function) {
    insertText = charAfterPos === "(" ? item.label : item.label + "()";
  }
  return {
    label: item.label,
    documentation: item.description && {
      kind: "markdown",
      value: item.description
    },
    insertText: insertText,
    kind: item.function ? CompletionItemKind.Function : CompletionItemKind.Variable
  };
}
