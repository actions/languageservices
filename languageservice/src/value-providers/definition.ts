import {BooleanDefinition} from "@actions/workflow-parser/templates/schema/boolean-definition";
import {Definition} from "@actions/workflow-parser/templates/schema/definition";
import {DefinitionType} from "@actions/workflow-parser/templates/schema/definition-type";
import {MappingDefinition} from "@actions/workflow-parser/templates/schema/mapping-definition";
import {OneOfDefinition} from "@actions/workflow-parser/templates/schema/one-of-definition";
import {SequenceDefinition} from "@actions/workflow-parser/templates/schema/sequence-definition";
import {StringDefinition} from "@actions/workflow-parser/templates/schema/string-definition";
import {getWorkflowSchema} from "@actions/workflow-parser/workflows/workflow-schema";
import {Value} from "./config.js";
import {stringsToValues} from "./strings-to-values.js";

export enum DefinitionValueMode {
  /**
   * We're getting completion options for a parent token
   * foo:
   *   ba|
   */
  Parent,

  /**
   * We're getting completion options for a key token. For example:
   * foo: |
   */
  Key
}

export function definitionValues(def: Definition, indentation: string, mode: DefinitionValueMode): Value[] {
  const schema = getWorkflowSchema();

  if (def instanceof MappingDefinition) {
    return mappingValues(def, schema.definitions, indentation, mode);
  }

  if (def instanceof OneOfDefinition) {
    return oneOfValues(def, schema.definitions, indentation, mode);
  }

  if (def instanceof BooleanDefinition) {
    return stringsToValues(["true", "false"]);
  }

  if (def instanceof StringDefinition && def.constant) {
    return [
      {
        label: def.constant,
        description: def.description
      }
    ];
  }

  if (def instanceof SequenceDefinition) {
    const itemDef = schema.getDefinition(def.itemType);
    if (itemDef) {
      return definitionValues(itemDef, indentation, mode);
    }
  }

  return [];
}

function mappingValues(
  mappingDefinition: MappingDefinition,
  definitions: {[key: string]: Definition},
  indentation: string,
  mode: DefinitionValueMode
): Value[] {
  const properties: Value[] = [];
  for (const [key, value] of Object.entries(mappingDefinition.properties)) {
    let insertText: string | undefined;

    let description: string | undefined;
    if (value.type) {
      const typeDef = definitions[value.type];
      description = typeDef?.description;

      if (typeDef) {
        switch (typeDef.definitionType) {
          case DefinitionType.Sequence:
            if (mode == DefinitionValueMode.Key) {
              insertText = `\n${indentation}${key}:\n${indentation}${indentation}- `;
            } else {
              insertText = `${key}:\n${indentation}- `;
            }
            break;

          case DefinitionType.Mapping:
            if (mode == DefinitionValueMode.Key) {
              insertText = `\n${indentation}${key}:\n${indentation}${indentation}`;
            } else {
              insertText = `${key}:\n${indentation}`;
            }
            break;

          case DefinitionType.OneOf:
            if (mode == DefinitionValueMode.Key) {
              insertText = `\n${indentation}${key}: `;
            } else {
              insertText = `${key}: `;
            }
            break;

          case DefinitionType.String:
          case DefinitionType.Boolean:
            if (mode == DefinitionValueMode.Key) {
              insertText = `\n${indentation}${key}: `;
            } else {
              insertText = `${key}: `;
            }
            break;

          default:
            insertText = `${key}: `;
        }
      }
    }

    properties.push({
      label: key,
      description,
      insertText
    });
  }
  return properties;
}

function oneOfValues(
  oneOfDefinition: OneOfDefinition,
  definitions: {[key: string]: Definition},
  indentation: string,
  mode: DefinitionValueMode
): Value[] {
  const values: Value[] = [];
  for (const key of oneOfDefinition.oneOf) {
    values.push(...definitionValues(definitions[key], indentation, mode));
  }
  return distinctValues(values);
}

function distinctValues(values: Value[]): Value[] {
  const map = new Map<string, Value>();
  for (const value of values) {
    map.set(value.label, value);
  }
  return Array.from(map.values());
}
