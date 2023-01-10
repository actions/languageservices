// called at runtime. expands expressions and re-validates the schema result after expansion

import {TemplateSchema} from "./schema";
import {Definition} from "./schema/definition";
import {DefinitionType} from "./schema/definition-type";
import {MappingDefinition} from "./schema/mapping-definition";
import {ScalarDefinition} from "./schema/scalar-definition";
import {SequenceDefinition} from "./schema/sequence-definition";
import {ANY} from "./template-constants";
import {TemplateContext} from "./template-context";
import {TemplateUnraveler} from "./template-unraveler";
import {LiteralToken, MappingToken, ScalarToken, StringToken, TemplateToken} from "./tokens";
import {TokenType} from "./tokens/types";

export function evaluateTemplate(
  context: TemplateContext,
  type: string,
  template: TemplateToken,
  removeBytes: number,
  fileId: number | undefined
): TemplateToken | undefined {
  let result: TemplateToken | undefined;

  const evaluator = new TemplateEvaluator(context, template, removeBytes);
  try {
    const definitionInfo = new DefinitionInfo(context, type);
    result = evaluator.evaluate(definitionInfo);

    if (result) {
      evaluator.unraveler.readEnd();
    }
  } catch (err) {
    context.error(fileId, err);
    result = undefined;
  }

  return result;
}

class TemplateEvaluator {
  public readonly context: TemplateContext;
  public readonly schema: TemplateSchema;
  public readonly unraveler: TemplateUnraveler;

  public constructor(context: TemplateContext, template: TemplateToken, removeBytes: number) {
    this.context = context;
    this.schema = context.schema;
    this.unraveler = new TemplateUnraveler(context, template, removeBytes);
  }

  public evaluate(definition: DefinitionInfo): TemplateToken {
    // Scalar
    const scalar = this.unraveler.allowScalar(definition.expand);
    if (scalar) {
      if (scalar.isLiteral) {
        return this.validate(scalar as LiteralToken, definition);
      } else {
        return scalar;
      }
    }

    // Sequence
    const sequence = this.unraveler.allowSequenceStart(definition.expand);
    if (sequence) {
      const sequenceDefinition = definition.getDefinitionsOfType(DefinitionType.Sequence)[0] as
        | SequenceDefinition
        | undefined;

      // Legal
      if (sequenceDefinition) {
        const itemDefinition = new DefinitionInfo(definition, sequenceDefinition.itemType);

        // Add each item
        while (!this.unraveler.allowSequenceEnd(definition.expand)) {
          const item = this.evaluate(itemDefinition);
          sequence.add(item);
        }
      }
      // Illegal
      else {
        // Error
        this.context.error(sequence, "A sequence was not expected");

        // Skip each item
        while (!this.unraveler.allowSequenceEnd(false)) {
          this.unraveler.skipSequenceItem();
        }
      }

      return sequence;
    }

    // Mapping
    const mapping = this.unraveler.allowMappingStart(definition.expand);
    if (mapping) {
      const mappingDefinitions = definition.getDefinitionsOfType(DefinitionType.Mapping) as MappingDefinition[];

      // Legal
      if (mappingDefinitions.length > 0) {
        if (
          mappingDefinitions.length > 1 ||
          Object.keys(mappingDefinitions[0].properties).length > 0 ||
          !mappingDefinitions[0].looseKeyType
        ) {
          this.handleMappingWithWellKnownProperties(definition, mappingDefinitions, mapping);
        } else {
          const keyDefinition = new DefinitionInfo(definition, mappingDefinitions[0].looseKeyType);
          const valueDefinition = new DefinitionInfo(definition, mappingDefinitions[0].looseValueType);
          this.handleMappingWithAllLooseProperties(definition, keyDefinition, valueDefinition, mapping);
        }
      }
      // Illegal
      else {
        this.context.error(mapping, "A mapping was not expected");

        while (!this.unraveler.allowMappingEnd(false)) {
          this.unraveler.skipMappingKey();
          this.unraveler.skipMappingValue();
        }
      }

      return mapping;
    }

    throw new Error("Expected a scalar value, a sequence, or a mapping");
  }

  private handleMappingWithWellKnownProperties(
    definition: DefinitionInfo,
    mappingDefinitions: MappingDefinition[],
    mapping: MappingToken
  ) {
    // Check if loose properties are allowed
    let looseKeyType: string | undefined;
    let looseValueType: string | undefined;
    let looseKeyDefinition: DefinitionInfo | undefined;
    let looseValueDefinition: DefinitionInfo | undefined;
    if (mappingDefinitions[0].looseKeyType) {
      looseKeyType = mappingDefinitions[0].looseKeyType;
      looseValueType = mappingDefinitions[0].looseValueType;
    }

    const upperKeys: {[upperKey: string]: boolean} = {};
    let hasExpressionKey = false;

    let nextKeyScalar: ScalarToken | undefined;
    while ((nextKeyScalar = this.unraveler.allowScalar(definition.expand))) {
      // Expression
      if (nextKeyScalar.isExpression) {
        hasExpressionKey = true;
        const anyDefinition = new DefinitionInfo(definition, ANY);
        mapping.add(nextKeyScalar, this.evaluate(anyDefinition));
        continue;
      }

      // Convert to StringToken if required
      const nextKey =
        nextKeyScalar.templateTokenType === TokenType.String
          ? (nextKeyScalar as StringToken)
          : new StringToken(
              nextKeyScalar.file,
              nextKeyScalar.range,
              nextKeyScalar.toString(),
              nextKeyScalar.definitionInfo
            );

      // Duplicate
      const upperKey = nextKey.value.toUpperCase();
      if (upperKeys[upperKey]) {
        this.context.error(nextKey, `'${nextKey.value}' is already defined`);
        this.unraveler.skipMappingValue();
        continue;
      }
      upperKeys[upperKey] = true;

      // Well known
      const nextValuePropertyDef = this.schema.matchPropertyAndFilter(mappingDefinitions, nextKey.value);
      if (nextValuePropertyDef?.type) {
        const nextValueDefinition = new DefinitionInfo(definition, nextValuePropertyDef.type);
        const nextValue = this.evaluate(nextValueDefinition);
        nextValue.propertyDefinition = nextValuePropertyDef;
        mapping.add(nextKey, nextValue);
        continue;
      }

      // Loose
      if (looseKeyType) {
        if (!looseKeyDefinition) {
          looseKeyDefinition = new DefinitionInfo(definition, looseKeyType);
          looseValueDefinition = new DefinitionInfo(definition, looseValueType!);
        }

        this.validate(nextKey, looseKeyDefinition);
        const nextValue = this.evaluate(looseValueDefinition!);
        mapping.add(nextKey, nextValue);
        continue;
      }

      // Error
      this.context.error(nextKey, `Unexpected value '${nextKey.value}'`);
      this.unraveler.skipMappingValue();
    }

    // Unable to filter to one definition
    if (mappingDefinitions.length > 1) {
      const hitCount: {[key: string]: number} = {};
      for (const mappingDefinition of mappingDefinitions) {
        for (const key of Object.keys(mappingDefinition.properties)) {
          hitCount[key] = (hitCount[key] ?? 0) + 1;
        }
      }

      const nonDuplicates: string[] = [];
      for (const key of Object.keys(hitCount)) {
        if (hitCount[key] === 1) {
          nonDuplicates.push(key);
        }
      }

      this.context.error(
        mapping,
        `There's not enough info to determine what you meant. Add one of these properties: ${nonDuplicates
          .sort()
          .join(", ")}`
      );
    }
    // Check required properties
    else if (mappingDefinitions.length === 1 && !hasExpressionKey) {
      for (const propertyName of Object.keys(mappingDefinitions[0].properties)) {
        const propertyDef = mappingDefinitions[0].properties[propertyName];
        if (propertyDef.required && !upperKeys[propertyName.toUpperCase()]) {
          this.context.error(mapping, `Required property is missing: ${propertyName}`);
        }
      }
    }

    this.unraveler.readMappingEnd();
  }

  private handleMappingWithAllLooseProperties(
    mappingDefinition: DefinitionInfo,
    keyDefinition: DefinitionInfo,
    valueDefinition: DefinitionInfo,
    mapping: MappingToken
  ): void {
    const upperKeys: {[key: string]: boolean} = {};

    let nextKeyScalar: ScalarToken | undefined;
    while ((nextKeyScalar = this.unraveler.allowScalar(mappingDefinition.expand))) {
      // Expression
      if (nextKeyScalar.isExpression) {
        if (nextKeyScalar.templateTokenType === TokenType.BasicExpression) {
          mapping.add(nextKeyScalar, this.evaluate(valueDefinition));
        } else {
          const anyDefinition = new DefinitionInfo(mappingDefinition, ANY);
          mapping.add(nextKeyScalar, this.evaluate(anyDefinition));
        }

        continue;
      }

      // Convert to StringToken if required
      const nextKey =
        nextKeyScalar.templateTokenType === TokenType.String
          ? (nextKeyScalar as StringToken)
          : new StringToken(
              nextKeyScalar.file,
              nextKeyScalar.range,
              nextKeyScalar.toString(),
              nextKeyScalar.definitionInfo
            );

      // Duplicate
      const upperKey = nextKey.value.toUpperCase();
      if (upperKeys[upperKey]) {
        this.context.error(nextKey, `'${nextKey.value}' is already defined`);
        this.unraveler.skipMappingValue();
        continue;
      }
      upperKeys[upperKey] = true;

      // Validate
      this.validate(nextKey, keyDefinition);

      // Add the pair
      const nextValue = this.evaluate(valueDefinition);
      mapping.add(nextKey, nextValue);
    }

    this.unraveler.readMappingEnd();
  }

  private validate(literal: LiteralToken, definition: DefinitionInfo): LiteralToken {
    // Legal
    const scalarDefinitions = definition.getScalarDefinitions();
    if (scalarDefinitions.some(x => x.isMatch(literal))) {
      return literal;
    }

    // Not a string, convert
    if (literal.templateTokenType !== TokenType.String) {
      const stringLiteral = new StringToken(literal.file, literal.range, literal.toString(), literal.definitionInfo);

      // Legal
      if (scalarDefinitions.some(x => x.isMatch(stringLiteral))) {
        return stringLiteral;
      }
    }

    // Illegal
    this.context.error(literal, `Unexpected value '${literal.toString()}'`);
    return literal;
  }
}

class DefinitionInfo {
  /**
   * Hashtable of available contexts
   */
  private readonly _upperAvailable: {[context: string]: boolean};
  /**
   * Allowed context
   */
  private readonly _allowed: string[];
  private readonly _schema: TemplateSchema;
  public readonly isDefinitionInfo = true;
  public readonly definition: Definition;
  public readonly expand: boolean;

  public constructor(context: TemplateContext, name: string);
  public constructor(parent: DefinitionInfo, name: string);
  public constructor(contextOrParent: TemplateContext | DefinitionInfo, name: string) {
    // "parent" overload
    let parent: DefinitionInfo | undefined;
    if ((contextOrParent as DefinitionInfo | undefined)?.isDefinitionInfo === true) {
      parent = contextOrParent as DefinitionInfo;
      this._schema = parent._schema;
      this._upperAvailable = parent._upperAvailable;
    }
    // "context" overload
    else {
      const context = contextOrParent as TemplateContext;
      this._schema = context.schema;
      this._upperAvailable = {};
      for (const namedContext of context.expressionNamedContexts) {
        this._upperAvailable[namedContext.toUpperCase()] = true;
      }
      for (const func of context.expressionFunctions) {
        this._upperAvailable[`${func.name}()`.toUpperCase()] = true;
      }
    }

    // Lookup the definition
    this.definition = this._schema.getDefinition(name);

    // Record allowed context
    if (this.definition.evaluatorContext.length > 0) {
      this._allowed = [];
      this.expand = true;

      // Copy parent allowed context
      const upperSeen: {[upper: string]: boolean} = {};
      for (const context of parent?._allowed ?? []) {
        this._allowed.push(context);
        const upper = context.toUpperCase();
        upperSeen[upper] = true;
        if (!this._upperAvailable[upper]) {
          this.expand = false;
        }
      }

      // Append context if unseen
      for (const context of this.definition.evaluatorContext) {
        const upper = context.toUpperCase();
        if (!upperSeen[upper]) {
          this._allowed.push(context);
          upperSeen[upper] = true;
          if (!this._upperAvailable[upper]) [(this.expand = false)];
        }
      }
    } else {
      this._allowed = parent?._allowed ?? [];
      this.expand = parent?.expand ?? false;
    }
  }

  public getScalarDefinitions(): ScalarDefinition[] {
    return this._schema.getScalarDefinitions(this.definition);
  }

  public getDefinitionsOfType(type: DefinitionType): Definition[] {
    return this._schema.getDefinitionsOfType(this.definition, type);
  }
}
