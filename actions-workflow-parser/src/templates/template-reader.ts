// template-reader *just* does schema validation

import {ObjectReader} from "./object-reader";
import {TemplateSchema} from "./schema";
import {DefinitionInfo} from "./schema/definition-info";
import {DefinitionType} from "./schema/definition-type";
import {MappingDefinition} from "./schema/mapping-definition";
import {ScalarDefinition} from "./schema/scalar-definition";
import {SequenceDefinition} from "./schema/sequence-definition";
import {StringDefinition} from "./schema/string-definition";
import {ANY, CLOSE_EXPRESSION, INSERT_DIRECTIVE, OPEN_EXPRESSION} from "./template-constants";
import {TemplateContext} from "./template-context";
import {
  BasicExpressionToken,
  ExpressionToken,
  InsertExpressionToken,
  LiteralToken,
  MappingToken,
  ScalarToken,
  StringToken,
  TemplateToken
} from "./tokens";
import {TokenRange} from "./tokens/token-range";
import {isString} from "./tokens/type-guards";
import {TokenType} from "./tokens/types";

const WHITESPACE_PATTERN = /\s/;

export function readTemplate(
  context: TemplateContext,
  type: string,
  objectReader: ObjectReader,
  fileId: number | undefined
): TemplateToken | undefined {
  const reader = new TemplateReader(context, objectReader, fileId);
  let value: TemplateToken | undefined;
  try {
    objectReader.validateStart();
    const definition = new DefinitionInfo(context.schema, type);
    value = reader.readValue(definition);
    objectReader.validateEnd();
  } catch (err) {
    context.error(fileId, err);
  }

  return value;
}

export interface ReadTemplateResult {
  value: TemplateToken;
  bytes: number;
}

class TemplateReader {
  private readonly _context: TemplateContext;
  private readonly _schema: TemplateSchema;
  private readonly _objectReader: ObjectReader;
  private readonly _fileId: number | undefined;

  public constructor(context: TemplateContext, objectReader: ObjectReader, fileId: number | undefined) {
    this._context = context;
    this._schema = context.schema;
    this._objectReader = objectReader;
    this._fileId = fileId;
  }

  public readValue(definition: DefinitionInfo): TemplateToken {
    // Scalar
    const literal = this._objectReader.allowLiteral();
    if (literal) {
      let scalar = this.parseScalar(literal, definition);
      scalar = this.validate(scalar, definition);
      return scalar;
    }

    // Sequence
    const sequence = this._objectReader.allowSequenceStart();
    if (sequence) {
      const sequenceDefinition = definition.getDefinitionsOfType(DefinitionType.Sequence)[0] as
        | SequenceDefinition
        | undefined;

      // Legal
      if (sequenceDefinition) {
        const itemDefinition = new DefinitionInfo(definition, sequenceDefinition.itemType);

        // Add each item
        while (!this._objectReader.allowSequenceEnd()) {
          const item = this.readValue(itemDefinition);
          sequence.add(item);
        }
      }
      // Illegal
      else {
        // Error
        this._context.error(sequence, "A sequence was not expected");

        // Skip each item
        while (!this._objectReader.allowSequenceEnd()) {
          this.skipValue();
        }
      }
      sequence.definitionInfo = definition;
      return sequence;
    }

    // Mapping
    const mapping = this._objectReader.allowMappingStart();
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
          this.handleMappingWithAllLooseProperties(
            definition,
            keyDefinition,
            valueDefinition,
            mappingDefinitions[0],
            mapping
          );
        }
      }
      // Illegal
      else {
        this._context.error(mapping, "A mapping was not expected");

        while (this._objectReader.allowMappingEnd()) {
          this.skipValue();
          this.skipValue();
        }
      }

      // handleMappingWithWellKnownProperties will only set a definition
      // if it can identify a single matching definition
      if (!mapping.definitionInfo) {
        mapping.definitionInfo = definition;
      }

      return mapping;
    }

    throw new Error("Expected a scalar value, a sequence, or a mapping");
  }

  private handleMappingWithWellKnownProperties(
    definition: DefinitionInfo,
    mappingDefinitions: MappingDefinition[],
    mapping: MappingToken
  ): void {
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

    let rawLiteral: LiteralToken | undefined;
    while ((rawLiteral = this._objectReader.allowLiteral())) {
      const nextKeyScalar = this.parseScalar(rawLiteral, definition);

      // Expression
      if (nextKeyScalar.isExpression) {
        hasExpressionKey = true;

        // Legal
        if (definition.allowedContext.length > 0) {
          const anyDefinition = new DefinitionInfo(definition, ANY);
          mapping.add(nextKeyScalar, this.readValue(anyDefinition));
        }
        // Illegal
        else {
          this._context.error(nextKeyScalar, "A template expression is not allowed in this context");
          this.skipValue();
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
        this._context.error(nextKey, `'${nextKey.value}' is already defined`);
        this.skipValue();
        continue;
      }
      upperKeys[upperKey] = true;

      // Well known
      const nextPropertyDef = this._schema.matchPropertyAndFilter(mappingDefinitions, nextKey.value);
      if (nextPropertyDef) {
        const nextDefinition = new DefinitionInfo(definition, nextPropertyDef.type);

        // Store the definition on the key, the value may have its own definition
        nextKey.definitionInfo = nextDefinition;

        // If the property has a description, it's a parameter that uses a shared type
        // and we need to make sure its description is set if there is one
        if (nextPropertyDef.description) {
          nextKey.description = nextPropertyDef.description;
        }

        const nextValue = this.readValue(nextDefinition);
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

        // Store the definition on the key, the value may have its own definition
        const nextDefinition = new DefinitionInfo(definition, mappingDefinitions[0].looseValueType);
        nextKey.definitionInfo = nextDefinition;

        const nextValue = this.readValue(looseValueDefinition!);
        mapping.add(nextKey, nextValue);
        continue;
      }

      // Error
      this._context.error(nextKey, `Unexpected value '${nextKey.value}'`);
      this.skipValue();
    }

    // If we matched a single definition from multiple,
    // update the token's definition to enable more specific editor
    // completion and validation
    if (mappingDefinitions.length === 1) {
      mapping.definitionInfo = new DefinitionInfo(definition, mappingDefinitions[0]);
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

      this._context.error(
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
          this._context.error(mapping, `Required property is missing: ${propertyName}`);
        }
      }
    }

    this.expectMappingEnd();
  }

  private handleMappingWithAllLooseProperties(
    definition: DefinitionInfo,
    keyDefinition: DefinitionInfo,
    valueDefinition: DefinitionInfo,
    mappingDefinition: MappingDefinition,
    mapping: MappingToken
  ): void {
    let nextValue: TemplateToken;
    const upperKeys: {[key: string]: boolean} = {};

    let rawLiteral: LiteralToken | undefined;
    while ((rawLiteral = this._objectReader.allowLiteral())) {
      const nextKeyScalar = this.parseScalar(rawLiteral, definition);
      nextKeyScalar.definitionInfo = keyDefinition;

      // Expression
      if (nextKeyScalar.isExpression) {
        // Legal
        if (definition.allowedContext.length > 0) {
          nextValue = this.readValue(valueDefinition);
          mapping.add(nextKeyScalar, nextValue);
        }
        // Illegal
        else {
          this._context.error(nextKeyScalar, "A template expression is not allowed in this context");
          this.skipValue();
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
        this._context.error(nextKey, `'${nextKey.value}' is already defined`);
        this.skipValue();
        continue;
      }
      upperKeys[upperKey] = true;

      // Validate
      this.validate(nextKey, keyDefinition);

      // Store the definition on the key, the value may have its own definition
      const nextDefinition = new DefinitionInfo(definition, mappingDefinition.looseValueType);
      nextKey.definitionInfo = nextDefinition;

      // Add the pair
      nextValue = this.readValue(valueDefinition);
      mapping.add(nextKey, nextValue);
    }

    this.expectMappingEnd();
  }

  private expectMappingEnd(): void {
    if (!this._objectReader.allowMappingEnd()) {
      throw new Error("Expected mapping end"); // Should never happen
    }
  }

  private skipValue(): void {
    // Scalar
    if (this._objectReader.allowLiteral()) {
      // Intentionally empty
    }
    // Sequence
    else if (this._objectReader.allowSequenceStart()) {
      while (!this._objectReader.allowSequenceEnd()) {
        this.skipValue();
      }
    }
    // Mapping
    else if (this._objectReader.allowMappingStart()) {
      while (!this._objectReader.allowMappingEnd()) {
        this.skipValue();
        this.skipValue();
      }
    }
    // Unexpected
    else {
      throw new Error("Expected a scalar value, a sequence, or a mapping");
    }
  }

  private validate(scalar: ScalarToken, definition: DefinitionInfo): ScalarToken {
    switch (scalar.templateTokenType) {
      case TokenType.Null:
      case TokenType.Boolean:
      case TokenType.Number:
      case TokenType.String: {
        const literal = scalar as LiteralToken;

        // Legal
        const scalarDefinitions = definition.getScalarDefinitions();
        let relevantDefinition: ScalarDefinition | undefined;
        if ((relevantDefinition = scalarDefinitions.find(x => x.isMatch(literal)))) {
          scalar.definitionInfo = new DefinitionInfo(definition, relevantDefinition);
          return scalar;
        }

        // Not a string, convert
        if (literal.templateTokenType !== TokenType.String) {
          const stringLiteral = new StringToken(
            literal.file,
            literal.range,
            literal.toString(),
            literal.definitionInfo
          );

          // Legal
          if ((relevantDefinition = scalarDefinitions.find(x => x.isMatch(stringLiteral)))) {
            stringLiteral.definitionInfo = new DefinitionInfo(definition, relevantDefinition);
            return stringLiteral;
          }
        }

        // Illegal
        this._context.error(literal, `Unexpected value '${literal.toString()}'`);
        return scalar;
      }
      case TokenType.BasicExpression:
        // Illegal
        if (definition.allowedContext.length === 0) {
          this._context.error(scalar, "A template expression is not allowed in this context");
        }

        return scalar;
      default:
        this._context.error(scalar, `Unexpected value '${scalar.toString()}'`);
        return scalar;
    }
  }

  private parseScalar(token: LiteralToken, definitionInfo: DefinitionInfo): ScalarToken {
    // Not a string
    if (!isString(token)) {
      return token;
    }

    const allowedContext = definitionInfo.allowedContext;
    const raw = token.source || token.value;

    let startExpression: number = raw.indexOf(OPEN_EXPRESSION);
    if (startExpression < 0) {
      // Doesn't contain "${{"
      // Check if value should still be evaluated as an expression
      if (definitionInfo.definition instanceof StringDefinition && definitionInfo.definition.isExpression) {
        const expression = this.parseIntoExpressionToken(token.range!, raw, allowedContext, token);
        if (expression) {
          return expression;
        }
      }
      return token;
    }

    // Break the value into segments of LiteralToken and ExpressionToken
    let encounteredError = false;
    const segments: ScalarToken[] = [];
    let i = 0;
    while (i < raw.length) {
      // An expression starts here
      if (i === startExpression) {
        // Find the end of the expression - i.e. "}}"
        startExpression = i;
        let endExpression = -1;
        let inString = false;
        for (i += OPEN_EXPRESSION.length; i < raw.length; i++) {
          if (raw[i] === "'") {
            inString = !inString; // Note, this handles escaped single quotes gracefully. E.x. 'foo''bar'
          } else if (!inString && raw[i] === "}" && raw[i - 1] === "}") {
            endExpression = i;
            i++;
            break;
          }
        }

        // Check if not closed
        if (endExpression < startExpression) {
          this._context.error(
            token,
            "The expression is not closed. An unescaped ${{ sequence was found, but the closing }} sequence was not found."
          );
          return token;
        }

        // Parse the expression
        const rawExpression = raw.substr(
          startExpression + OPEN_EXPRESSION.length,
          endExpression - startExpression + 1 - OPEN_EXPRESSION.length - CLOSE_EXPRESSION.length
        );

        let tr = token.range!;
        if (tr.start[0] === tr.end[0]) {
          // If it's a single line expression, adjust the range to only cover the sub-expression
          tr = {
            start: [tr.start[0], tr.start[1] + startExpression],
            end: [tr.end[0], tr.start[1] + endExpression + 1]
          };
        } else {
          // Adjust the range to only cover the expression for multi-line strings
          const startRaw = raw.substring(0, startExpression);
          const adjustedStartLine = startRaw.split("\n").length;
          const beginningOfLine = startRaw.lastIndexOf("\n");
          const adjustedStart = startExpression - beginningOfLine;
          const adjustedEnd = endExpression - beginningOfLine + 1;

          tr = {
            start: [tr.start[0] + adjustedStartLine, adjustedStart],
            end: [tr.start[0] + adjustedStartLine, adjustedEnd]
          };
        }

        const expression = this.parseIntoExpressionToken(tr, rawExpression, allowedContext, token);

        if (!expression) {
          // Record that we've hit an error but continue to validate any other expressions
          // that might be in the string
          encounteredError = true;
        } else {
          // Check if a directive was used when not allowed
          if (expression.directive && (startExpression !== 0 || i < raw.length)) {
            this._context.error(
              token,
              `The directive '${expression.directive}' is not allowed in this context. Directives are not supported for expressions that are embedded within a string. Directives are only supported when the entire value is an expression.`
            );
            return token;
          }

          // Add the segment
          segments.push(expression);
        }

        // Look for the next expression
        startExpression = raw.indexOf(OPEN_EXPRESSION, i);
      }
      // The next expression is further ahead
      else if (i < startExpression) {
        // Append the segment
        this.addString(segments, token.range, raw.substr(i, startExpression - i), token.definitionInfo);

        // Adjust the position
        i = startExpression;
      }
      // No remaining expressions
      else {
        this.addString(segments, token.range, raw.substr(i), token.definitionInfo);
        break;
      }
    }

    // If we've hit any error during parsing, return the original token
    if (encounteredError) {
      return token;
    }

    // Check if can convert to a literal
    // For example, the escaped expression: ${{ '{{ this is a literal }}' }}
    if (segments.length === 1 && segments[0].templateTokenType === TokenType.BasicExpression) {
      const basicExpression = segments[0] as BasicExpressionToken;
      const str = this.getExpressionString(basicExpression.expression);
      if (str !== undefined) {
        return new StringToken(this._fileId, token.range, str, token.definitionInfo);
      }
    }

    // Check if only one segment
    if (segments.length === 1) {
      return segments[0];
    }

    // Build the new expression, using the format function
    const format: string[] = [];
    const args: string[] = [];
    const expressionTokens: BasicExpressionToken[] = [];
    let argIndex = 0;
    for (const segment of segments) {
      if (isString(segment)) {
        const text = segment.value
          .replace(/'/g, "''") // Escape quotes
          .replace(/\{/g, "{{") // Escape braces
          .replace(/\}/g, "}}");
        format.push(text);
      } else {
        format.push(`{${argIndex}}`); // Append format arg
        argIndex++;

        const expression = segment as BasicExpressionToken;
        args.push(", ");
        args.push(expression.expression);

        expressionTokens.push(expression);
      }
    }

    return new BasicExpressionToken(
      this._fileId,
      token.range,
      `format('${format.join("")}'${args.join("")})`,
      token.definitionInfo,
      expressionTokens
    );
  }

  private parseIntoExpressionToken(
    tr: TokenRange,
    rawExpression: string,
    allowedContext: string[],
    token: TemplateToken
  ): ExpressionToken | undefined {
    const parseExpressionResult = this.parseExpression(tr, rawExpression, allowedContext, token.definitionInfo);

    // Check for error
    if (parseExpressionResult.error) {
      this._context.error(token, parseExpressionResult.error, tr);
      return undefined;
    }

    return parseExpressionResult.expression!;
  }

  private parseExpression(
    range: TokenRange | undefined,
    value: string,
    allowedContext: string[],
    definitionInfo: DefinitionInfo | undefined
  ): ParseExpressionResult {
    const trimmed = value.trim();

    // Check if the value is empty
    if (!trimmed) {
      return <ParseExpressionResult>{
        error: new Error("An expression was expected")
      };
    }

    // Try to find a matching directive
    const matchDirectiveResult = this.matchDirective(trimmed, INSERT_DIRECTIVE, 0);
    if (matchDirectiveResult.isMatch) {
      return <ParseExpressionResult>{
        expression: new InsertExpressionToken(this._fileId, range, definitionInfo)
      };
    } else if (matchDirectiveResult.error) {
      return <ParseExpressionResult>{
        error: matchDirectiveResult.error
      };
    }

    // Check if valid expression
    try {
      ExpressionToken.validateExpression(trimmed, allowedContext);
    } catch (err) {
      return <ParseExpressionResult>{
        error: err
      };
    }

    // Return the expression
    return <ParseExpressionResult>{
      expression: new BasicExpressionToken(this._fileId, range, trimmed, definitionInfo, undefined),
      error: undefined
    };
  }

  private addString(
    segments: ScalarToken[],
    range: TokenRange | undefined,
    value: string,
    definition: DefinitionInfo | undefined
  ): void {
    // If the last segment was a LiteralToken, then append to the last segment
    if (segments.length > 0 && segments[segments.length - 1].templateTokenType === TokenType.String) {
      const lastSegment = segments[segments.length - 1] as StringToken;
      segments[segments.length - 1] = new StringToken(this._fileId, range, `${lastSegment.value}${value}`, definition);
    }
    // Otherwise add a new LiteralToken
    else {
      segments.push(new StringToken(this._fileId, range, value, definition));
    }
  }

  private matchDirective(trimmed: string, directive: string, expectedParameters: number): MatchDirectiveResult {
    const parameters: string[] = [];
    if (
      trimmed.startsWith(directive) &&
      (trimmed.length === directive.length || WHITESPACE_PATTERN.test(trimmed[directive.length]))
    ) {
      let startIndex = directive.length;
      let inString = false;
      let parens = 0;
      for (let i = startIndex; i < trimmed.length; i++) {
        const c = trimmed[i];
        if (WHITESPACE_PATTERN.test(c) && !inString && parens == 0) {
          if (startIndex < 1) {
            parameters.push(trimmed.substr(startIndex, i - startIndex));
          }

          startIndex = i + 1;
        } else if (c === "'") {
          inString = !inString;
        } else if (c === "(" && !inString) {
          parens++;
        } else if (c === ")" && !inString) {
          parens--;
        }
      }

      if (startIndex < trimmed.length) {
        parameters.push(trimmed.substr(startIndex));
      }

      if (expectedParameters != parameters.length) {
        return <MatchDirectiveResult>{
          isMatch: false,
          parameters: [],
          error: new Error(
            `Exactly ${expectedParameters} parameter(s) were expected following the directive '${directive}'. Actual parameter count: ${parameters.length}`
          )
        };
      }

      return <MatchDirectiveResult>{
        isMatch: true,
        parameters: parameters
      };
    }

    return <MatchDirectiveResult>{
      isMatch: false,
      parameters: parameters
    };
  }

  private getExpressionString(trimmed: string): string | undefined {
    const result: string[] = [];

    let inString = false;
    for (let i = 0; i < trimmed.length; i++) {
      const c = trimmed[i];
      if (c === "'") {
        inString = !inString;
        if (inString && i !== 0) {
          result.push(c);
        }
      } else if (!inString) {
        return undefined;
      } else {
        result.push(c);
      }
    }

    return result.join("");
  }
}

interface ParseExpressionResult {
  expression: ExpressionToken | undefined;
  error: Error | undefined;
}

interface MatchDirectiveResult {
  isMatch: boolean;
  parameters: string[];
  error: Error | undefined;
}
