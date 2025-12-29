import {complete as completeExpression, DescriptionDictionary} from "@actions/expressions";
import {CompletionItem as ExpressionCompletionItem} from "@actions/expressions/completion";
import {isBasicExpression, isSequence, isString} from "@actions/workflow-parser";
import {ErrorPolicy} from "@actions/workflow-parser/model/convert";
import {DefinitionType} from "@actions/workflow-parser/templates/schema/definition-type";
import {OneOfDefinition} from "@actions/workflow-parser/templates/schema/one-of-definition";
import {OPEN_EXPRESSION} from "@actions/workflow-parser/templates/template-constants";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/index";
import {MappingToken} from "@actions/workflow-parser/templates/tokens/mapping-token";
import {TokenRange} from "@actions/workflow-parser/templates/tokens/token-range";
import {TokenType} from "@actions/workflow-parser/templates/tokens/types";
import {File} from "@actions/workflow-parser/workflows/file";
import {FileProvider} from "@actions/workflow-parser/workflows/file-provider";
import {getWorkflowSchema} from "@actions/workflow-parser/workflows/workflow-schema";
import {Position, TextDocument} from "vscode-languageserver-textdocument";
import {CompletionItem, CompletionItemKind, CompletionItemTag, Range, TextEdit} from "vscode-languageserver-types";
import {ContextProviderConfig} from "./context-providers/config.js";
import {getContext, Mode} from "./context-providers/default.js";
import {getWorkflowContext, WorkflowContext} from "./context/workflow-context.js";
import {validatorFunctions} from "./expression-validation/functions.js";
import {error} from "./log.js";
import {isPotentiallyExpression} from "./utils/expression-detection.js";
import {findToken} from "./utils/find-token.js";
import {guessIndentation} from "./utils/indentation-guesser.js";
import {mapRange} from "./utils/range.js";
import {isPlaceholder, transform} from "./utils/transform.js";
import {fetchOrConvertWorkflowTemplate, fetchOrParseWorkflow} from "./utils/workflow-cache.js";
import {Value, ValueProviderConfig} from "./value-providers/config.js";
import {defaultValueProviders} from "./value-providers/default.js";
import {DefinitionValueMode, definitionValues, TokenStructure} from "./value-providers/definition.js";

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

  // Add escape hatch completions when completing an empty scalar value for a one-of field.
  // These provide a way out of "dead end" situations where no scalar completions exist
  // but alternative structural forms (list, mapping) are available.
  const escapeHatches = getEscapeHatchCompletions(token, keyToken, indentString, newPos);
  values.push(...escapeHatches);

  // Figure out what text to replace when the user picks a completion.
  // For example, if they typed `runs-|` and pick `runs-on`, we need to replace `runs-`.
  let replaceRange: Range | undefined;
  if (token?.range) {
    // Prefer the token's range since it accounts for YAML syntax like quotes
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

    // Escape hatches provide their own textEdit to restructure the YAML
    let textEdit: TextEdit;
    if (value.textEdit) {
      textEdit = TextEdit.replace(value.textEdit.range, value.textEdit.newText);
    } else if (replaceRange) {
      textEdit = TextEdit.replace(replaceRange, newText);
    } else {
      textEdit = TextEdit.insert(position, newText);
    }

    const item: CompletionItem = {
      label: value.label,
      detail: value.detail,
      filterText: value.filterText,
      sortText: value.sortText,
      documentation: value.description && {
        kind: "markdown",
        value: value.description
      },
      tags: value.deprecated ? [CompletionItemTag.Deprecated] : undefined,
      textEdit
    };

    return item;
  });
}

/**
 * Retrieves completion values for a token based on value providers and definitions.
 *
 * This function determines which values to suggest for auto-completion by:
 * 1. First checking for custom value providers configured for the token's definition key
 * 2. Then checking for default value providers for the token's definition key
 * 3. Finally falling back to values derived from the token's schema definition
 *
 * The results are filtered to exclude duplicates (e.g., keys already defined in a mapping
 * or values already present in a sequence) and sorted alphabetically.
 */
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

  // When a schema allows multiple formats (e.g., `runs-on` can be a string OR a mapping),
  // only suggest completions that match what the user has already started typing.
  // For example, if they've started a mapping, don't suggest string values.
  const tokenStructure = getTokenStructure(token);
  const values = definitionValues(
    def,
    indentation,
    keyToken ? DefinitionValueMode.Key : DefinitionValueMode.Parent,
    tokenStructure
  );
  return filterAndSortCompletionOptions(values, existingValues);
}

/**
 * Determines what YAML structure the user has committed to, if any.
 *
 * Returns:
 * - "mapping" if the user has started a key-value structure (e.g., `runs-on:\n  group: |`)
 * - "sequence" if the user has started a list (e.g., `runs-on:\n  - |`)
 * - "scalar" if the user has started typing a plain value (e.g., `runs-on: ubuntu-|`)
 * - undefined if the user hasn't committed yet (e.g., `runs-on: |` with nothing typed)
 */
function getTokenStructure(token: TemplateToken | null): TokenStructure {
  if (!token) {
    return undefined;
  }

  switch (token.templateTokenType) {
    case TokenType.Mapping:
      return "mapping";
    case TokenType.Sequence:
      return "sequence";
    case TokenType.Null:
      // Null means `key: ` with nothing - user hasn't committed to a type yet
      return undefined;
    case TokenType.String: {
      // Empty string means `key: |` - user hasn't committed yet
      // Non-empty string means user has started typing a scalar value
      const stringToken = token.assertString("getTokenStructure expected string token");
      if (stringToken.value === "") {
        return undefined;
      }
      return "scalar";
    }
    case TokenType.Boolean:
    case TokenType.Number:
      return "scalar";
    default:
      return undefined;
  }
}

/**
 * Generates escape hatch completions that allow switching from scalar form to
 * alternative structural forms (sequence or mapping) when the value is empty.
 *
 * For example, at `runs-on: |`, this adds "(switch to list)" and "(switch to full syntax)"
 * completions that restructure the YAML to `runs-on:\n  - |` or `runs-on:\n  |`.
 *
 * Only shown when:
 * - Completing in value position (keyToken exists)
 * - Value is empty (user hasn't committed to a structure yet)
 * - Definition allows sequence or mapping structure
 */
function getEscapeHatchCompletions(
  token: TemplateToken | null,
  keyToken: TemplateToken | null,
  indentation: string,
  position: Position
): Value[] {
  // Only show escape hatches when value is empty
  const tokenStructure = getTokenStructure(token);
  if (tokenStructure !== undefined) {
    return [];
  }

  // Need a key token with a definition
  if (!keyToken?.definition) {
    return [];
  }

  // Determine which structural types are available from the definition
  const def = keyToken.definition;
  const schema = getWorkflowSchema();
  const buckets = {
    sequence: false,
    mapping: false
  };

  if (def instanceof OneOfDefinition) {
    // OneOf: check each variant
    for (const variantKey of def.oneOf) {
      const variantDef = schema.definitions[variantKey];
      if (variantDef) {
        switch (variantDef.definitionType) {
          case DefinitionType.Sequence:
            buckets.sequence = true;
            break;
          case DefinitionType.Mapping:
            buckets.mapping = true;
            break;
        }
      }
    }
  } else {
    // Single definition type
    switch (def.definitionType) {
      case DefinitionType.Sequence:
        buckets.sequence = true;
        break;
      case DefinitionType.Mapping:
        buckets.mapping = true;
        break;
    }
  }

  const results: Value[] = [];
  const keyName = isString(keyToken) ? keyToken.value : "";
  const keyRange = keyToken.range;

  if (!keyRange || !keyName) {
    return [];
  }

  // Calculate the range from key start to current position
  // This covers "key: " so we can replace it with "key:\n  - " or "key:\n  "
  const editRange = {
    start: {line: keyRange.start.line - 1, character: keyRange.start.column - 1},
    end: {line: position.line, character: position.character}
  };

  if (buckets.sequence) {
    results.push({
      label: "(switch to list)",
      sortText: "zzz_switch_1",
      filterText: keyName, // Allow filtering by key name
      textEdit: {
        range: editRange,
        newText: `${keyName}:\n${indentation}- `
      }
    });
  }

  if (buckets.mapping) {
    results.push({
      label: "(switch to mapping)",
      sortText: "zzz_switch_2",
      filterText: keyName, // Allow filtering by key name
      textEdit: {
        range: editRange,
        newText: `${keyName}:\n${indentation}`
      }
    });
  }

  return results;
}

/**
 * Collects values that are already present in the current context, so they can be
 * excluded from completion suggestions.
 *
 * For sequences (lists), returns all existing items. For example, if the user has:
 *   labels:
 *     - bug
 *     - |
 * This returns {"bug"} so we don't suggest "bug" again.
 *
 * For mappings, returns all existing keys. For example, if the user has:
 *   jobs:
 *     build:
 *       runs-on: ubuntu-latest
 *       |
 * This returns {"runs-on"} so we don't suggest "runs-on" again.
 */
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

  const cursorOffset = getOffsetInContent(token.range, currentInput, pos);
  const expressionInput = (getExpressionInput(currentInput, cursorOffset) || "").trim();

  try {
    return completeExpression(expressionInput, context, [], validatorFunctions).map(item =>
      mapExpressionCompletionItem(item, currentInput[cursorOffset])
    );
  } catch (e) {
    error(`Error while completing expression: '${(e as Error)?.message || "<no details>"}'`);
    return [];
  }
}

function filterAndSortCompletionOptions(options: Value[], existingValues?: Set<string>) {
  options = options.filter(x => !existingValues?.has(x.label));
  options.sort((a, b) => (a.sortText ?? a.label).localeCompare(b.sortText ?? b.label));
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

/**
 * Converts a document position to an offset within the token's content string.
 */
function getOffsetInContent(tokenRange: TokenRange, currentInput: string, pos: Position): number {
  const range = mapRange(tokenRange);

  if (range.start.line === range.end.line) {
    // Single-line example:
    //   if: github.ref == 'main'
    //       ^8      ^15 (cursor)
    // currentInput = "github.ref == 'main'"
    // offset = 15 - 8 = 7
    return pos.character - range.start.character;
  }

  // Multi-line example:
  //   if: |                         <- line 3 (range.start.line)
  //     first line                  <- line 4, content line 0
  //     second line                 <- line 5, content line 1
  //     github.                     <- line 6, content line 2, cursor at index 11
  //            ^11 (cursor)
  //
  // currentInput = "    first line\n    second line\n    github."
  //                 ^0              ^15              ^32        ^43

  // Line index within content.
  // From the example:
  // lineIndexWithinContent = pos.line - range.start.line - 1
  //                        = 6 - 3 - 1 = 2
  const lineIndexWithinContent = pos.line - range.start.line - 1;

  // Length of content before current line.
  // From the example:
  // lengthOfContentBeforeCurrentLine => 14 + 1 = 15 (after first iteration)
  //                                  => 31 + 1 = 32 (after second iteration)
  let lengthOfContentBeforeCurrentLine = 0;
  for (let i = 0; i < lineIndexWithinContent; i++) {
    lengthOfContentBeforeCurrentLine = currentInput.indexOf("\n", lengthOfContentBeforeCurrentLine) + 1;
  }

  // Final offset within content.
  // From the example:
  // finalOffset = lengthOfContentBeforeCurrentLine + pos.character
  //             = 32 + 11 = 43
  return lengthOfContentBeforeCurrentLine + pos.character;
}
