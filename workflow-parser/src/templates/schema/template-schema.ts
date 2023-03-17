import {TokenType} from "../../templates/tokens/types";
import {ObjectReader} from "../object-reader";
import {
  ALLOWED_VALUES,
  ANY,
  BOOLEAN,
  BOOLEAN_DEFINITION,
  BOOLEAN_DEFINITION_PROPERTIES,
  CONSTANT,
  CONTEXT,
  DEFINITION,
  DEFINITIONS,
  DESCRIPTION,
  IGNORE_CASE,
  IS_EXPRESSION,
  ITEM_TYPE,
  LOOSE_KEY_TYPE,
  LOOSE_VALUE_TYPE,
  MAPPING,
  MAPPING_DEFINITION,
  MAPPING_DEFINITION_PROPERTIES,
  MAPPING_PROPERTY_VALUE,
  NON_EMPTY_STRING,
  NULL,
  NULL_DEFINITION,
  NULL_DEFINITION_PROPERTIES,
  NUMBER,
  NUMBER_DEFINITION,
  NUMBER_DEFINITION_PROPERTIES,
  ONE_OF,
  ONE_OF_DEFINITION,
  PROPERTIES,
  PROPERTY_VALUE,
  REQUIRED,
  REQUIRE_NON_EMPTY,
  SEQUENCE,
  SEQUENCE_DEFINITION,
  SEQUENCE_DEFINITION_PROPERTIES,
  SEQUENCE_OF_NON_EMPTY_STRING,
  STRING,
  STRING_DEFINITION,
  STRING_DEFINITION_PROPERTIES,
  TEMPLATE_SCHEMA,
  TYPE,
  VERSION
} from "../template-constants";
import {TemplateContext, TemplateValidationErrors} from "../template-context";
import {readTemplate} from "../template-reader";
import {MappingToken, SequenceToken, StringToken} from "../tokens";
import {NoOperationTraceWriter} from "../trace-writer";
import {BooleanDefinition} from "./boolean-definition";
import {Definition} from "./definition";
import {DefinitionType} from "./definition-type";
import {MappingDefinition} from "./mapping-definition";
import {NullDefinition} from "./null-definition";
import {NumberDefinition} from "./number-definition";
import {OneOfDefinition} from "./one-of-definition";
import {PropertyDefinition} from "./property-definition";
import {ScalarDefinition} from "./scalar-definition";
import {SequenceDefinition} from "./sequence-definition";
import {StringDefinition} from "./string-definition";

/**
 * This models the root schema object and contains definitions
 */
export class TemplateSchema {
  private static readonly _definitionNamePattern = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
  private static _internalSchema: TemplateSchema | undefined;
  public readonly definitions: {[key: string]: Definition} = {};
  public readonly version: string = "";

  public constructor(mapping?: MappingToken) {
    // Add built-in type: null
    this.definitions[NULL] = new NullDefinition(NULL);

    // Add built-in type: boolean
    this.definitions[BOOLEAN] = new BooleanDefinition(BOOLEAN);

    // Add built-in type: number
    this.definitions[NUMBER] = new NumberDefinition(NUMBER);

    // Add built-in type: string
    this.definitions[STRING] = new StringDefinition(STRING);

    // Add built-in type: sequence
    const sequenceDefinition = new SequenceDefinition(SEQUENCE);
    sequenceDefinition.itemType = ANY;
    this.definitions[sequenceDefinition.key] = sequenceDefinition;

    // Add built-in type: mapping
    const mappingDefinition = new MappingDefinition(MAPPING);
    mappingDefinition.looseKeyType = STRING;
    mappingDefinition.looseValueType = ANY;
    this.definitions[mappingDefinition.key] = mappingDefinition;

    // Add built-in type: any
    const anyDefinition = new OneOfDefinition(ANY);
    anyDefinition.oneOf.push(NULL);
    anyDefinition.oneOf.push(BOOLEAN);
    anyDefinition.oneOf.push(NUMBER);
    anyDefinition.oneOf.push(STRING);
    anyDefinition.oneOf.push(SEQUENCE);
    anyDefinition.oneOf.push(MAPPING);
    this.definitions[anyDefinition.key] = anyDefinition;

    if (mapping) {
      for (const pair of mapping) {
        const key = pair.key.assertString(`${TEMPLATE_SCHEMA} key`);
        switch (key.value) {
          case VERSION: {
            this.version = pair.value.assertString(`${TEMPLATE_SCHEMA} ${VERSION}`).value;
            break;
          }
          case DEFINITIONS: {
            const definitions = pair.value.assertMapping(`${TEMPLATE_SCHEMA} ${DEFINITIONS}`);
            for (const definitionsPair of definitions) {
              const definitionsKey = definitionsPair.key.assertString(`${TEMPLATE_SCHEMA} ${DEFINITIONS} key`);
              const definitionsValue = definitionsPair.value.assertMapping(`${TEMPLATE_SCHEMA} ${DEFINITIONS} value`);
              let definition: Definition | undefined;
              for (const definitionPair of definitionsValue) {
                const definitionKey = definitionPair.key.assertString(`${DEFINITION} key`);
                const mappingToken = definitionsPair.value as MappingToken;
                switch (definitionKey.value) {
                  case NULL:
                    definition = new NullDefinition(definitionsKey.value, definitionsValue);
                    break;
                  case BOOLEAN:
                    definition = new BooleanDefinition(definitionsKey.value, definitionsValue);
                    break;
                  case NUMBER:
                    definition = new NumberDefinition(definitionsKey.value, definitionsValue);
                    break;
                  case STRING:
                    definition = new StringDefinition(definitionsKey.value, definitionsValue);
                    break;
                  case SEQUENCE:
                    definition = new SequenceDefinition(definitionsKey.value, definitionsValue);
                    break;
                  case MAPPING:
                    definition = new MappingDefinition(definitionsKey.value, definitionsValue);
                    break;
                  case ONE_OF:
                    definition = new OneOfDefinition(definitionsKey.value, definitionsValue);
                    break;
                  case ALLOWED_VALUES:
                    // Change the allowed-values definition into a one-of definition and its corresponding string definitions
                    for (const item of mappingToken) {
                      if (item.value.templateTokenType === TokenType.Sequence) {
                        // Create a new string definition for each StringToken in the sequence
                        const sequenceToken = item.value as SequenceToken;
                        for (const activity of sequenceToken) {
                          if (activity.templateTokenType === TokenType.String) {
                            const stringToken = activity as StringToken;
                            const allowedValuesKey = definitionsKey.value + "-" + stringToken.value;
                            const allowedValuesDef = new StringDefinition(allowedValuesKey);
                            allowedValuesDef.constant = stringToken.toDisplayString();
                            this.definitions[allowedValuesKey] = allowedValuesDef;
                          }
                        }
                      }
                    }
                    definition = new OneOfDefinition(definitionsKey.value, definitionsValue);
                    break;
                  case CONTEXT:
                  case DESCRIPTION:
                    continue;
                  default:
                    // throws
                    definitionKey.assertUnexpectedValue(`${DEFINITION} mapping key`);
                    break;
                }

                break;
              }

              if (!definition) {
                throw new Error(`Not enough information to construct definition '${definitionsKey.value}'`);
              }

              this.definitions[definitionsKey.value] = definition;
            }
            break;
          }
          default:
            // throws
            key.assertUnexpectedValue(`${TEMPLATE_SCHEMA} key`);
            break;
        }
      }
    }
  }

  /**
   * Looks up a definition by name
   */
  public getDefinition(name: string): Definition {
    const result = this.definitions[name];
    if (result) {
      return result;
    }

    throw new Error(`Schema definition '${name}' not found`);
  }

  /**
   * Expands one-of definitions and returns all scalar definitions
   */
  public getScalarDefinitions(definition: Definition): ScalarDefinition[] {
    const result: ScalarDefinition[] = [];
    switch (definition.definitionType) {
      case DefinitionType.Null:
      case DefinitionType.Boolean:
      case DefinitionType.Number:
      case DefinitionType.String:
        result.push(definition as ScalarDefinition);
        break;
      case DefinitionType.OneOf: {
        const oneOf = definition as OneOfDefinition;

        // Expand nested one-of definitions
        for (const nestedName of oneOf.oneOf) {
          const nestedDefinition = this.getDefinition(nestedName);
          result.push(...this.getScalarDefinitions(nestedDefinition));
        }
        break;
      }
    }

    return result;
  }

  /**
   * Expands one-of definitions and returns all matching definitions by type
   */
  public getDefinitionsOfType(definition: Definition, type: DefinitionType): Definition[] {
    const result: Definition[] = [];
    if (definition.definitionType === type) {
      result.push(definition);
    } else if (definition.definitionType === DefinitionType.OneOf) {
      const oneOf = definition as OneOfDefinition;
      for (const nestedName of oneOf.oneOf) {
        const nestedDefinition = this.getDefinition(nestedName);
        if (nestedDefinition.definitionType === type) {
          result.push(nestedDefinition);
        }
      }
    }

    return result;
  }

  /**
   * Attempts match the property name to a property defined by any of the specified definitions.
   * If matched, any unmatching definitions are filtered from the definitions array.
   * Returns the type information for the matched property.
   */
  public matchPropertyAndFilter(
    definitions: MappingDefinition[],
    propertyName: string
  ): PropertyDefinition | undefined {
    let result: PropertyDefinition | undefined;

    // Check for a matching well-known property
    let notFoundInSome = false;
    for (const definition of definitions) {
      const propertyDef = definition.properties[propertyName];
      if (propertyDef) {
        result = propertyDef;
      } else {
        notFoundInSome = true;
      }
    }

    // Filter the matched definitions if needed
    if (result && notFoundInSome) {
      for (let i = 0; i < definitions.length; ) {
        if (definitions[i].properties[propertyName]) {
          i++;
        } else {
          definitions.splice(i, 1);
        }
      }
    }

    return result;
  }

  private validate(): void {
    const oneOfDefinitions: {[key: string]: OneOfDefinition} = {};

    for (const name of Object.keys(this.definitions)) {
      if (!name.match(TemplateSchema._definitionNamePattern)) {
        throw new Error(`Invalid definition name '${name}'`);
      }

      const definition = this.definitions[name];

      // Delay validation for 'one-of' definitions
      if (definition.definitionType === DefinitionType.OneOf) {
        oneOfDefinitions[name] = definition as OneOfDefinition;
      }
      // Otherwise validate now
      else {
        definition.validate(this, name);
      }
    }

    // Validate 'one-of' definitions
    for (const name of Object.keys(oneOfDefinitions)) {
      const oneOf = oneOfDefinitions[name];
      oneOf.validate(this, name);
    }
  }

  /**
   * Loads a user-defined schema file
   */
  public static load(objectReader: ObjectReader): TemplateSchema {
    const context = new TemplateContext(
      new TemplateValidationErrors(10, 500),
      TemplateSchema.getInternalSchema(),
      new NoOperationTraceWriter()
    );
    const template = readTemplate(context, TEMPLATE_SCHEMA, objectReader, undefined);
    context.errors.check();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const mapping = template!.assertMapping(TEMPLATE_SCHEMA);
    const schema = new TemplateSchema(mapping);
    schema.validate();
    return schema;
  }

  /**
   * Gets the internal schema used for reading user-defined schema files
   */
  private static getInternalSchema(): TemplateSchema {
    if (TemplateSchema._internalSchema === undefined) {
      const schema = new TemplateSchema();

      // template-schema
      let mappingDefinition = new MappingDefinition(TEMPLATE_SCHEMA);
      mappingDefinition.properties[VERSION] = new PropertyDefinition(
        new StringToken(undefined, undefined, NON_EMPTY_STRING, undefined)
      );
      mappingDefinition.properties[DEFINITIONS] = new PropertyDefinition(
        new StringToken(undefined, undefined, DEFINITIONS, undefined)
      );
      schema.definitions[mappingDefinition.key] = mappingDefinition;

      // definitions
      mappingDefinition = new MappingDefinition(DEFINITIONS);
      mappingDefinition.looseKeyType = NON_EMPTY_STRING;
      mappingDefinition.looseValueType = DEFINITION;
      schema.definitions[mappingDefinition.key] = mappingDefinition;

      // definition
      let oneOfDefinition = new OneOfDefinition(DEFINITION);
      oneOfDefinition.oneOf.push(NULL_DEFINITION);
      oneOfDefinition.oneOf.push(BOOLEAN_DEFINITION);
      oneOfDefinition.oneOf.push(NUMBER_DEFINITION);
      oneOfDefinition.oneOf.push(STRING_DEFINITION);
      oneOfDefinition.oneOf.push(SEQUENCE_DEFINITION);
      oneOfDefinition.oneOf.push(MAPPING_DEFINITION);
      oneOfDefinition.oneOf.push(ONE_OF_DEFINITION);
      schema.definitions[oneOfDefinition.key] = oneOfDefinition;

      // null-definition
      mappingDefinition = new MappingDefinition(NULL_DEFINITION);
      mappingDefinition.properties[DESCRIPTION] = new PropertyDefinition(
        new StringToken(undefined, undefined, STRING, undefined)
      );
      mappingDefinition.properties[CONTEXT] = new PropertyDefinition(
        new StringToken(undefined, undefined, SEQUENCE_OF_NON_EMPTY_STRING, undefined)
      );
      mappingDefinition.properties[NULL] = new PropertyDefinition(
        new StringToken(undefined, undefined, NULL_DEFINITION_PROPERTIES, undefined)
      );
      schema.definitions[mappingDefinition.key] = mappingDefinition;

      // null-definition-properties
      mappingDefinition = new MappingDefinition(NULL_DEFINITION_PROPERTIES);
      schema.definitions[mappingDefinition.key] = mappingDefinition;

      // boolean-definition
      mappingDefinition = new MappingDefinition(BOOLEAN_DEFINITION);
      mappingDefinition.properties[DESCRIPTION] = new PropertyDefinition(
        new StringToken(undefined, undefined, STRING, undefined)
      );
      mappingDefinition.properties[CONTEXT] = new PropertyDefinition(
        new StringToken(undefined, undefined, SEQUENCE_OF_NON_EMPTY_STRING, undefined)
      );
      mappingDefinition.properties[BOOLEAN] = new PropertyDefinition(
        new StringToken(undefined, undefined, BOOLEAN_DEFINITION_PROPERTIES, undefined)
      );
      schema.definitions[mappingDefinition.key] = mappingDefinition;

      // boolean-definition-properties
      mappingDefinition = new MappingDefinition(BOOLEAN_DEFINITION_PROPERTIES);
      schema.definitions[mappingDefinition.key] = mappingDefinition;

      // number-definition
      mappingDefinition = new MappingDefinition(NUMBER_DEFINITION);
      mappingDefinition.properties[DESCRIPTION] = new PropertyDefinition(
        new StringToken(undefined, undefined, STRING, undefined)
      );
      mappingDefinition.properties[CONTEXT] = new PropertyDefinition(
        new StringToken(undefined, undefined, SEQUENCE_OF_NON_EMPTY_STRING, undefined)
      );
      mappingDefinition.properties[NUMBER] = new PropertyDefinition(
        new StringToken(undefined, undefined, NUMBER_DEFINITION_PROPERTIES, undefined)
      );
      schema.definitions[mappingDefinition.key] = mappingDefinition;

      // number-definition-properties
      mappingDefinition = new MappingDefinition(NUMBER_DEFINITION_PROPERTIES);
      schema.definitions[mappingDefinition.key] = mappingDefinition;

      // string-definition
      mappingDefinition = new MappingDefinition(STRING_DEFINITION);
      mappingDefinition.properties[DESCRIPTION] = new PropertyDefinition(
        new StringToken(undefined, undefined, STRING, undefined)
      );
      mappingDefinition.properties[CONTEXT] = new PropertyDefinition(
        new StringToken(undefined, undefined, SEQUENCE_OF_NON_EMPTY_STRING, undefined)
      );
      mappingDefinition.properties[STRING] = new PropertyDefinition(
        new StringToken(undefined, undefined, STRING_DEFINITION_PROPERTIES, undefined)
      );
      schema.definitions[mappingDefinition.key] = mappingDefinition;

      // string-definition-properties
      mappingDefinition = new MappingDefinition(STRING_DEFINITION_PROPERTIES);
      mappingDefinition.properties[CONSTANT] = new PropertyDefinition(
        new StringToken(undefined, undefined, NON_EMPTY_STRING, undefined)
      );
      mappingDefinition.properties[IGNORE_CASE] = new PropertyDefinition(
        new StringToken(undefined, undefined, BOOLEAN, undefined)
      );
      mappingDefinition.properties[REQUIRE_NON_EMPTY] = new PropertyDefinition(
        new StringToken(undefined, undefined, BOOLEAN, undefined)
      );
      mappingDefinition.properties[IS_EXPRESSION] = new PropertyDefinition(
        new StringToken(undefined, undefined, BOOLEAN, undefined)
      );
      schema.definitions[mappingDefinition.key] = mappingDefinition;

      // sequence-definition
      mappingDefinition = new MappingDefinition(SEQUENCE_DEFINITION);
      mappingDefinition.properties[DESCRIPTION] = new PropertyDefinition(
        new StringToken(undefined, undefined, STRING, undefined)
      );
      mappingDefinition.properties[CONTEXT] = new PropertyDefinition(
        new StringToken(undefined, undefined, SEQUENCE_OF_NON_EMPTY_STRING, undefined)
      );
      mappingDefinition.properties[SEQUENCE] = new PropertyDefinition(
        new StringToken(undefined, undefined, SEQUENCE_DEFINITION_PROPERTIES, undefined)
      );
      schema.definitions[mappingDefinition.key] = mappingDefinition;

      // sequence-definition-properties
      mappingDefinition = new MappingDefinition(SEQUENCE_DEFINITION_PROPERTIES);
      mappingDefinition.properties[ITEM_TYPE] = new PropertyDefinition(
        new StringToken(undefined, undefined, NON_EMPTY_STRING, undefined)
      );
      schema.definitions[mappingDefinition.key] = mappingDefinition;

      // mapping-definition
      mappingDefinition = new MappingDefinition(MAPPING_DEFINITION);
      mappingDefinition.properties[DESCRIPTION] = new PropertyDefinition(
        new StringToken(undefined, undefined, STRING, undefined)
      );
      mappingDefinition.properties[CONTEXT] = new PropertyDefinition(
        new StringToken(undefined, undefined, SEQUENCE_OF_NON_EMPTY_STRING, undefined)
      );
      mappingDefinition.properties[MAPPING] = new PropertyDefinition(
        new StringToken(undefined, undefined, MAPPING_DEFINITION_PROPERTIES, undefined)
      );
      schema.definitions[mappingDefinition.key] = mappingDefinition;

      // mapping-definition-properties
      mappingDefinition = new MappingDefinition(MAPPING_DEFINITION_PROPERTIES);
      mappingDefinition.properties[PROPERTIES] = new PropertyDefinition(
        new StringToken(undefined, undefined, PROPERTIES, undefined)
      );
      mappingDefinition.properties[LOOSE_KEY_TYPE] = new PropertyDefinition(
        new StringToken(undefined, undefined, NON_EMPTY_STRING, undefined)
      );
      mappingDefinition.properties[LOOSE_VALUE_TYPE] = new PropertyDefinition(
        new StringToken(undefined, undefined, NON_EMPTY_STRING, undefined)
      );
      schema.definitions[mappingDefinition.key] = mappingDefinition;

      // properties
      mappingDefinition = new MappingDefinition(PROPERTIES);
      mappingDefinition.looseKeyType = NON_EMPTY_STRING;
      mappingDefinition.looseValueType = PROPERTY_VALUE;
      schema.definitions[mappingDefinition.key] = mappingDefinition;

      // property-value
      oneOfDefinition = new OneOfDefinition(PROPERTY_VALUE);
      oneOfDefinition.oneOf.push(NON_EMPTY_STRING);
      oneOfDefinition.oneOf.push(MAPPING_PROPERTY_VALUE);
      schema.definitions[oneOfDefinition.key] = oneOfDefinition;

      // mapping-property-value
      mappingDefinition = new MappingDefinition(MAPPING_PROPERTY_VALUE);
      mappingDefinition.properties[TYPE] = new PropertyDefinition(
        new StringToken(undefined, undefined, NON_EMPTY_STRING, undefined)
      );
      mappingDefinition.properties[REQUIRED] = new PropertyDefinition(
        new StringToken(undefined, undefined, BOOLEAN, undefined)
      );
      mappingDefinition.properties[DESCRIPTION] = new PropertyDefinition(
        new StringToken(undefined, undefined, STRING, undefined)
      );
      schema.definitions[mappingDefinition.key] = mappingDefinition;

      // one-of-definition
      mappingDefinition = new MappingDefinition(ONE_OF_DEFINITION);
      mappingDefinition.properties[DESCRIPTION] = new PropertyDefinition(
        new StringToken(undefined, undefined, STRING, undefined)
      );
      mappingDefinition.properties[CONTEXT] = new PropertyDefinition(
        new StringToken(undefined, undefined, SEQUENCE_OF_NON_EMPTY_STRING, undefined)
      );
      mappingDefinition.properties[ONE_OF] = new PropertyDefinition(
        new StringToken(undefined, undefined, SEQUENCE_OF_NON_EMPTY_STRING, undefined)
      );
      mappingDefinition.properties[ALLOWED_VALUES] = new PropertyDefinition(
        new StringToken(undefined, undefined, SEQUENCE_OF_NON_EMPTY_STRING, undefined)
      );
      schema.definitions[mappingDefinition.key] = mappingDefinition;

      // non-empty-string
      const stringDefinition = new StringDefinition(NON_EMPTY_STRING);
      stringDefinition.requireNonEmpty = true;
      schema.definitions[stringDefinition.key] = stringDefinition;

      // sequence-of-non-empty-string
      const sequenceDefinition = new SequenceDefinition(SEQUENCE_OF_NON_EMPTY_STRING);
      sequenceDefinition.itemType = NON_EMPTY_STRING;
      schema.definitions[sequenceDefinition.key] = sequenceDefinition;

      schema.validate();

      TemplateSchema._internalSchema = schema;
    }

    return TemplateSchema._internalSchema;
  }
}
