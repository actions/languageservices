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

          case DefinitionType.OneOf: {
            // Expand one-of into multiple completions based on structural type
            const oneOfDef = typeDef as OneOfDefinition;
            const expanded = expandOneOfToCompletions(oneOfDef, definitions, key, description, indentation, mode);
            properties.push(...expanded);
            continue; // Skip the default push below
          }

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

/**
 * Bucket type for one-of expansion
 */
type StructuralBucket = "scalar" | "sequence" | "mapping";

/**
 * Get the structural bucket for a definition type.
 * Nested one-of is treated as scalar.
 */
function getStructuralBucket(defType: DefinitionType): StructuralBucket {
  switch (defType) {
    case DefinitionType.Sequence:
      return "sequence";
    case DefinitionType.Mapping:
      return "mapping";
    default:
      // String, Boolean, Number, Null, OneOf (nested), AllowedValues -> scalar
      // Note, nested OneOf is assumed to be all scalar values, which is true in practice.
      return "scalar";
  }
}

/**
 * Expand a one-of definition into multiple completion items based on structural types.
 * Returns one completion per unique structural type (scalar, sequence, mapping).
 */
function expandOneOfToCompletions(
  oneOfDef: OneOfDefinition,
  definitions: {[key: string]: Definition},
  key: string,
  description: string | undefined,
  indentation: string,
  mode: DefinitionValueMode
): Value[] {
  // Bucket variants by structural type
  const buckets: Record<StructuralBucket, boolean> = {
    scalar: false,
    sequence: false,
    mapping: false
  };

  for (const variantKey of oneOfDef.oneOf) {
    const variantDef = definitions[variantKey];
    if (variantDef) {
      const bucket = getStructuralBucket(variantDef.definitionType);
      buckets[bucket] = true;
    }
  }

  const results: Value[] = [];

  // Count how many structural types are present
  const bucketCount = [buckets.scalar, buckets.sequence, buckets.mapping].filter(Boolean).length;
  const needsQualifier = bucketCount > 1;

  // Emit completions in order: scalar, sequence, mapping
  if (buckets.scalar) {
    // In Key mode, insert newline and indentation to produce valid YAML structure
    const insertText = mode === DefinitionValueMode.Key ? `\n${indentation}${key}: ` : `${key}: `;
    results.push({
      label: key,
      description,
      insertText
    });
  }

  if (buckets.sequence) {
    const insertText =
      mode === DefinitionValueMode.Key
        ? `\n${indentation}${key}:\n${indentation}${indentation}- `
        : `${key}:\n${indentation}- `;
    results.push({
      label: needsQualifier ? `${key} (list)` : key,
      description,
      insertText,
      filterText: needsQualifier ? key : undefined
    });
  }

  if (buckets.mapping) {
    const insertText =
      mode === DefinitionValueMode.Key
        ? `\n${indentation}${key}:\n${indentation}${indentation}`
        : `${key}:\n${indentation}`;
    results.push({
      label: needsQualifier ? `${key} (full syntax)` : key,
      description,
      insertText,
      filterText: needsQualifier ? key : undefined
    });
  }

  return results;
}
