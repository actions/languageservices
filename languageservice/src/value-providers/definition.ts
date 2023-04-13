import {BooleanDefinition} from "@actions/workflow-parser/templates/schema/boolean-definition";
import {Definition} from "@actions/workflow-parser/templates/schema/definition";
import {DefinitionType} from "@actions/workflow-parser/templates/schema/definition-type";
import {MappingDefinition} from "@actions/workflow-parser/templates/schema/mapping-definition";
import {OneOfDefinition} from "@actions/workflow-parser/templates/schema/one-of-definition";
import {SequenceDefinition} from "@actions/workflow-parser/templates/schema/sequence-definition";
import {StringDefinition} from "@actions/workflow-parser/templates/schema/string-definition";
import {getWorkflowSchema} from "@actions/workflow-parser/workflows/workflow-schema";
import {Value} from "./config";
import {stringsToValues} from "./strings-to-values";

export function definitionValues(def: Definition, indentation: string): Value[] {
  const schema = getWorkflowSchema();

  if (def instanceof MappingDefinition) {
    return mappingValues(def, schema.definitions, indentation);
  }

  if (def instanceof OneOfDefinition) {
    return oneOfValues(def, schema.definitions, indentation);
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
      return definitionValues(itemDef, indentation);
    }
  }

  return [];
}

function mappingValues(
  mappingDefinition: MappingDefinition,
  definitions: {[key: string]: Definition},
  indentation: string
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
            insertText = `${key}:\n${indentation}- `;
            break;

          case DefinitionType.Mapping:
            insertText = `${key}:\n${indentation}`;
            break;

          case DefinitionType.OneOf:
            // No special insertText in this case
            break;

          case DefinitionType.String:
            insertText = `\n${indentation}${key}: `;
            break;

          case DefinitionType.Boolean:
            insertText = `\n${indentation}${key}: `;
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
  indentation: string
): Value[] {
  const values: Value[] = [];
  for (const key of oneOfDefinition.oneOf) {
    values.push(...definitionValues(definitions[key], indentation));
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
