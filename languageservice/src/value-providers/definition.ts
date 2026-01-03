import {NullDefinition} from "@actions/workflow-parser/templates/schema/null-definition";
import {BooleanDefinition} from "@actions/workflow-parser/templates/schema/boolean-definition";
import {Definition} from "@actions/workflow-parser/templates/schema/definition";
import {DefinitionType} from "@actions/workflow-parser/templates/schema/definition-type";
import {MappingDefinition} from "@actions/workflow-parser/templates/schema/mapping-definition";
import {OneOfDefinition} from "@actions/workflow-parser/templates/schema/one-of-definition";
import {SequenceDefinition} from "@actions/workflow-parser/templates/schema/sequence-definition";
import {StringDefinition} from "@actions/workflow-parser/templates/schema/string-definition";
import {TemplateSchema} from "@actions/workflow-parser/templates/schema/template-schema";
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

/**
 * What YAML structure the user has started typing.
 * Used to filter completions - e.g., if user started a mapping, don't show string completions.
 */
export type TokenStructure = "scalar" | "sequence" | "mapping" | undefined;

/**
 * Generates completion values from a workflow schema definition.
 *
 * This is the fallback when no custom or default value provider exists for a token.
 * It reads the schema definition to determine what values are valid.
 *
 * Examples:
 * - For a job definition this returns keys like "runs-on", "steps", "env", "timeout-minutes", etc.
 * - For `shell: |`, the schema says it's a string with no constants,
 *   so this returns no completions
 * - For `continue-on-error: |` on a step, the schema has a boolean definition,
 *   so this returns ["true", "false"]
 *
 * @param tokenStructure - If provided, filters completions to only those matching
 *   the YAML structure the user has already started (e.g., only mapping keys if
 *   they've started a mapping)
 * @param schema - The schema to use for definition lookups
 */
export function definitionValues(
  def: Definition,
  indentation: string,
  mode: DefinitionValueMode,
  tokenStructure: TokenStructure | undefined,
  schema: TemplateSchema
): Value[] {
  if (def instanceof MappingDefinition) {
    return mappingValues(def, schema.definitions, indentation, mode);
  }

  if (def instanceof OneOfDefinition) {
    return oneOfValues(def, schema.definitions, indentation, mode, tokenStructure, schema);
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
      return definitionValues(itemDef, indentation, mode, undefined, schema);
    }
  }

  return [];
}

/**
 * Returns completion items for keys in a mapping (object).
 *
 * For example, given the job definition, this returns completions for
 * "runs-on", "steps", "env", etc. Each completion includes appropriate
 * insert text based on the expected value type:
 * - Sequence properties insert `key:\n  - ` to start a list
 * - Mapping properties insert `key:\n  ` to start nested keys
 * - Scalar properties insert `key: ` for inline values
 */
function mappingValues(
  mappingDefinition: MappingDefinition,
  definitions: {[key: string]: Definition},
  indentation: string,
  mode: DefinitionValueMode
): Value[] {
  const properties: Value[] = [];
  for (const [key, value] of Object.entries(mappingDefinition.properties)) {
    let insertText: string | undefined;

    // Prefer the property's own description (from the schema's property definition),
    // fall back to the type definition's description if the property doesn't have one
    let description: string | undefined = value.description;
    if (value.type) {
      const typeDef = definitions[value.type];
      if (!description) {
        description = typeDef?.description;
      }

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

/**
 * Returns completions for values that can be one of several types.
 *
 * For example, `on:` can be a string ("push"), a list (["push", "pull_request"]),
 * or a mapping with event configuration. This function collects completions from
 * all valid variants.
 *
 * If the user has already started typing a specific structure (e.g., started a list),
 * only completions for that structure are returned.
 */
function oneOfValues(
  oneOfDefinition: OneOfDefinition,
  definitions: {[key: string]: Definition},
  indentation: string,
  mode: DefinitionValueMode,
  tokenStructure: TokenStructure | undefined,
  schema: TemplateSchema
): Value[] {
  const values: Value[] = [];
  for (const key of oneOfDefinition.oneOf) {
    const variantDef = definitions[key];

    // Should never happen - the schema should always have valid references
    if (!variantDef) {
      continue;
    }

    // Skip variants that don't match what the user has already started typing.
    // For example, if user is at `runs-on:\n  |` (inside a mapping), skip the string
    // variant - only include the mapping variant that suggests keys like "group" or "labels".
    if (tokenStructure) {
      const variantBucket = getStructuralBucket(variantDef.definitionType);
      if (variantBucket !== tokenStructure) {
        continue;
      }
    }

    // In Key mode (after colon, e.g., `on: |`), only include scalar variants when
    // completing an empty value. Mapping/sequence forms require newlines which is
    // confusing when typing inline. Users who want those forms can use completions
    // like `(full syntax)` or `(list)` at the parent level.
    if (!tokenStructure && mode === DefinitionValueMode.Key) {
      const variantBucket = getStructuralBucket(variantDef.definitionType);
      if (variantBucket !== "scalar") {
        continue;
      }
    }

    values.push(...definitionValues(variantDef, indentation, mode, tokenStructure, schema));
  }
  return distinctValues(values);
}

/**
 * Deduplicates values by label and labelDetail.
 * Values with the same label but different labelDetails are preserved as distinct items.
 */
function distinctValues(values: Value[]): Value[] {
  const map = new Map<string, Value>();
  for (const value of values) {
    // Include labelDetail in the key to preserve variants with different details
    const key = value.labelDetail ? `${value.label}\0${value.labelDetail}` : value.label;
    map.set(key, value);
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
 * Creates completion items for a key whose value can be multiple formats.
 *
 * For example, `runs-on` can be a string, list, or mapping. This function creates
 * separate completions for each format:
 * - "runs-on" for the string form (`runs-on: ubuntu-latest`)
 * - "runs-on (list)" for the list form (`runs-on:\n  - ubuntu-latest`)
 * - "runs-on (full syntax)" for the mapping form (`runs-on:\n  group: my-group`)
 *
 * The qualifier (list/full syntax) is only added when multiple formats exist.
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

  // Track if scalar bucket only contains null (no actual string/boolean/number values)
  let scalarIsOnlyNull = true;

  for (const variantKey of oneOfDef.oneOf) {
    const variantDef = definitions[variantKey];
    if (variantDef) {
      const bucket = getStructuralBucket(variantDef.definitionType);
      buckets[bucket] = true;

      // Check if this scalar is NOT null
      if (bucket === "scalar" && !(variantDef instanceof NullDefinition)) {
        scalarIsOnlyNull = false;
      }
    }
  }

  const results: Value[] = [];

  // Count how many structural types are present
  const bucketCount = [buckets.scalar, buckets.sequence, buckets.mapping].filter(Boolean).length;
  const needsQualifier = bucketCount > 1;

  // Emit completions in order: scalar, sequence, mapping
  // Use sortText to preserve this order (scalar sorts first, then 1=sequence, 2=mapping)
  //
  // In Key mode (after colon on same line), skip the key completion if scalar only allows null.
  // Example: at `on: |`, we want `check_run` to insert inline, not start a new mapping.
  //
  // In Parent mode (typing a new key), we DO show it since `check_run:` with no value
  // is valid (triggers on all check_run events).
  const skipNullOnlyScalar = mode === DefinitionValueMode.Key && scalarIsOnlyNull;
  if (buckets.scalar && !skipNullOnlyScalar) {
    // If cursor is after colon (`on: |`), insert newline first so result is `on:\n  check_run: `
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
      label: key,
      description,
      labelDetail: needsQualifier ? "list" : undefined,
      insertText,
      sortText: needsQualifier ? `${key} 1` : undefined
    });
  }

  if (buckets.mapping) {
    const insertText =
      mode === DefinitionValueMode.Key
        ? `\n${indentation}${key}:\n${indentation}${indentation}`
        : `${key}:\n${indentation}`;
    results.push({
      label: key,
      description,
      labelDetail: needsQualifier ? "full syntax" : undefined,
      insertText,
      sortText: needsQualifier ? `${key} 2` : undefined
    });
  }

  return results;
}
