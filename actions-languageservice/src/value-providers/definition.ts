import {BooleanDefinition} from "@github/actions-workflow-parser/templates/schema/boolean-definition";
import {Definition} from "@github/actions-workflow-parser/templates/schema/definition";
import {MappingDefinition} from "@github/actions-workflow-parser/templates/schema/mapping-definition";
import {OneOfDefinition} from "@github/actions-workflow-parser/templates/schema/one-of-definition";
import {SequenceDefinition} from "@github/actions-workflow-parser/templates/schema/sequence-definition";
import {StringDefinition} from "@github/actions-workflow-parser/templates/schema/string-definition";
import {getWorkflowSchema} from "@github/actions-workflow-parser/workflows/workflow-schema";
import {Value} from "./config";
import {stringsToValues} from "./strings-to-values";

export function definitionValues(def: Definition): Value[] {
  const schema = getWorkflowSchema();

  if (def instanceof MappingDefinition) {
    return mappingValues(def);
  }

  if (def instanceof OneOfDefinition) {
    return oneOfValues(def, schema.definitions);
  }

  if (def instanceof BooleanDefinition) {
    return stringsToValues(["true", "false"]);
  }

  if (def instanceof StringDefinition && def.constant) {
    return stringsToValues([def.constant]);
  }

  if (def instanceof SequenceDefinition) {
    const itemDef = schema.getDefinition(def.itemType);
    if (itemDef) {
      return definitionValues(itemDef);
    }
  }

  return [];
}

function mappingValues(mappingDefinition: MappingDefinition): Value[] {
  const properties: Value[] = [];
  for (const [key, value] of Object.entries(mappingDefinition.properties)) {
    properties.push({label: key, description: value.description});
  }
  return properties;
}

function oneOfValues(oneOfDefinition: OneOfDefinition, definitions: {[key: string]: Definition}): Value[] {
  const values: Value[] = [];
  for (const key of oneOfDefinition.oneOf) {
    values.push(...definitionValues(definitions[key]));
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
