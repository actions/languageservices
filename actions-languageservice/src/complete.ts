import { convertWorkflowTemplate, parseWorkflow, WorkflowTemplate } from "@github/actions-workflow-parser";
import {
  SEQUENCE_TYPE,
  STRING_TYPE,
  MAPPING_TYPE,
  TemplateToken,
  NULL_TYPE,
} from "@github/actions-workflow-parser/templates/tokens/index";
import { MappingToken } from "@github/actions-workflow-parser/templates/tokens/mapping-token";
import { SequenceToken } from "@github/actions-workflow-parser/templates/tokens/sequence-token";
import { StringToken } from "@github/actions-workflow-parser/templates/tokens/string-token";
import { File } from "@github/actions-workflow-parser/workflows/file";
import { Position, TextDocument } from "vscode-languageserver-textdocument";
import { CompletionItem } from "vscode-languageserver-types";
import { nullTrace } from "./nulltrace";
import { findInnerTokenAndParent } from "./utils/find-token";
import { transform } from "./utils/transform";
import { Value, ValueProviderConfig } from "./value-providers/config";
import { defaultValueProviders } from "./value-providers/default";

export async function complete(
  textDocument: TextDocument,
  position: Position,
  valueProviderConfig?: ValueProviderConfig
): Promise<CompletionItem[]> {
  // Fix the input to work around YAML parsing issues
  const [newDoc, newPos] = transform(textDocument, position);

  const file: File = {
    name: textDocument.uri,
    content: newDoc.getText(),
  };
  const result = parseWorkflow(file.name, [file], nullTrace);
  const [innerToken, parent] = findInnerTokenAndParent(newPos, result.value);
  let template: WorkflowTemplate | undefined = undefined;
  const valueToRemove = parent?.definition?.keyname;
  if (result.value) {
    template = convertWorkflowTemplate(result.context, result.value);
    console.log("template", template);
  }

  const values = await getValues(
    innerToken,
    parent,
    newPos,
    textDocument.uri,
    valueProviderConfig,
    template,
  );
  const valuesFiltered = values.filter((x) => x.label !== valueToRemove);
  return valuesFiltered.map((value) => CompletionItem.create(value.label));
}

async function getValues(
  token: TemplateToken | null,
  parent: TemplateToken | null,
  position: Position,
  workflowUri: string,
  valueProviderConfig: ValueProviderConfig | undefined,
  template: WorkflowTemplate | undefined,
): Promise<Value[]> {
  if (!parent) {
    return [];
  }

  if (token?.templateTokenType === NULL_TYPE) {
    // Ensure there's a space after the parent key
    if (parent.range && position.character + 1 === parent.range.end[1]) {
      return [];
    }
  }

  const existingValues = getExistingValues(token, parent);
  console.log("Parent", parent);
  console.log("Token", token);

  let customValues: Value[] | undefined = undefined;
  if (token?.definition?.key) {
    customValues = await valueProviderConfig?.getCustomValues(
      token.definition.key,
      { uri: workflowUri },
      template,
    );
    // add to custom values?
  }

  if (customValues !== undefined) {
    console.log("filterAndSortCompletionOptions with customValues")
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

  console.log("filterAndSortCompletionOptions with values")
  return filterAndSortCompletionOptions(values, existingValues);
}

function getExistingValues(token: TemplateToken | null, parent: TemplateToken) {
  // For incomplete YAML, we may only have a parent token
  if (token) {
    if (
      token.templateTokenType !== STRING_TYPE ||
      parent.templateTokenType !== SEQUENCE_TYPE
    ) {
      return;
    }

    const sequenceValues = new Set<string>();
    const seqToken = parent as SequenceToken;
    for (let i = 0; i < seqToken.count; i++) {
      const t = seqToken.get(i);
      if (t.isLiteral && t.templateTokenType === STRING_TYPE) {
        // Should we support other literal values here?
        sequenceValues.add((t as StringToken).value);
      }
    }
    return sequenceValues;
  }

  if (parent.templateTokenType === MAPPING_TYPE) {
    // No token and parent is a mapping, so we're completing a key
    const mapKeys = new Set<string>();
    const mapToken = parent as MappingToken;
    for (let i = 0; i < mapToken.count; i++) {
      const key = mapToken.get(i).key;
      if (key.isLiteral && key.templateTokenType === STRING_TYPE) {
        mapKeys.add((key as StringToken).value);
      }
    }

    return mapKeys;
  }
}

function filterAndSortCompletionOptions(
  options: Value[],
  existingValues?: Set<string>
) {
  options = options.filter(
    (x) => !existingValues || !existingValues.has(x.label)
  );
  options.sort((a, b) => a.label.localeCompare(b.label));
  return options;
}
