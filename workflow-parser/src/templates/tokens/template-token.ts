import {BooleanToken, MappingToken, NullToken, NumberToken, ScalarToken, SequenceToken, StringToken} from "./index.js";
import {Definition} from "../schema/definition.js";
import {DefinitionInfo} from "../schema/definition-info.js";
import {PropertyDefinition} from "../schema/property-definition.js";
import {SerializedToken} from "./serialization.js";
import {TokenRange} from "./token-range.js";
import {TraversalState} from "./traversal-state.js";
import {TokenType, tokenTypeName} from "./types.js";

export class TemplateTokenError extends Error {
  constructor(message: string, public readonly token?: TemplateToken) {
    super(message);
  }
}

export abstract class TemplateToken {
  // Fields for serialization
  private readonly type: TokenType;
  private _description: string | undefined;
  public readonly file: number | undefined;
  public readonly range: TokenRange | undefined;
  public definitionInfo: DefinitionInfo | undefined;
  public propertyDefinition: PropertyDefinition | undefined;

  /**
   * Base class for all template tokens
   */
  public constructor(
    type: TokenType,
    file: number | undefined,
    range: TokenRange | undefined,
    definitionInfo: DefinitionInfo | undefined
  ) {
    this.type = type;
    this.file = file;
    this.range = range;
    this.definitionInfo = definitionInfo;
  }

  public get templateTokenType(): number {
    return this.type;
  }

  public get line(): number | undefined {
    return this.range?.start.line;
  }

  public get col(): number | undefined {
    return this.range?.start.column;
  }

  public get definition(): Definition | undefined {
    return this.definitionInfo?.definition;
  }

  get description(): string | undefined {
    return this._description || this.propertyDefinition?.description || this.definition?.description;
  }

  set description(description: string | undefined) {
    this._description = description;
  }

  public abstract get isScalar(): boolean;

  public abstract get isLiteral(): boolean;

  public abstract get isExpression(): boolean;

  public abstract clone(omitSource?: boolean): TemplateToken;

  public typeName(): string {
    return tokenTypeName(this.type);
  }

  /**
   * Asserts expected type and throws a good debug message if unexpected
   */
  public assertNull(objectDescription: string): NullToken {
    if (this.type === TokenType.Null) {
      return this as unknown as NullToken;
    }

    throw new TemplateTokenError(
      `Unexpected type '${this.typeName()}' encountered while reading '${objectDescription}'. The type '${tokenTypeName(
        TokenType.Null
      )}' was expected.`,
      this
    );
  }

  /**
   * Asserts expected type and throws a good debug message if unexpected
   */
  public assertBoolean(objectDescription: string): BooleanToken {
    if (this.type === TokenType.Boolean) {
      return this as unknown as BooleanToken;
    }

    throw new TemplateTokenError(
      `Unexpected type '${this.typeName()}' encountered while reading '${objectDescription}'. The type '${tokenTypeName(
        TokenType.Boolean
      )}' was expected.`,
      this
    );
  }

  /**
   * Asserts expected type and throws a good debug message if unexpected
   */
  public assertNumber(objectDescription: string): NumberToken {
    if (this.type === TokenType.Number) {
      return this as unknown as NumberToken;
    }

    throw new TemplateTokenError(
      `Unexpected type '${this.typeName()}' encountered while reading '${objectDescription}'. The type '${tokenTypeName(
        TokenType.Number
      )}' was expected.`,
      this
    );
  }

  /**
   * Asserts expected type and throws a good debug message if unexpected
   */
  public assertString(objectDescription: string): StringToken {
    if (this.type === TokenType.String) {
      return this as unknown as StringToken;
    }

    throw new TemplateTokenError(
      `Unexpected type '${this.typeName()}' encountered while reading '${objectDescription}'. The type '${tokenTypeName(
        TokenType.String
      )}' was expected.`,
      this
    );
  }

  /**
   * Asserts expected type and throws a good debug message if unexpected
   */
  public assertScalar(objectDescription: string): ScalarToken {
    if ((this as unknown as ScalarToken | undefined)?.isScalar === true) {
      return this as unknown as ScalarToken;
    }

    throw new TemplateTokenError(
      `Unexpected type '${this.typeName()}' encountered while reading '${objectDescription}'. The type 'ScalarToken' was expected.`,
      this
    );
  }

  /**
   * Asserts expected type and throws a good debug message if unexpected
   */
  public assertSequence(objectDescription: string): SequenceToken {
    if (this.type === TokenType.Sequence) {
      return this as unknown as SequenceToken;
    }

    throw new TemplateTokenError(
      `Unexpected type '${this.typeName()}' encountered while reading '${objectDescription}'. The type '${tokenTypeName(
        TokenType.Sequence
      )}' was expected.`,
      this
    );
  }

  /**
   * Asserts expected type and throws a good debug message if unexpected
   */
  public assertMapping(objectDescription: string): MappingToken {
    if (this.type === TokenType.Mapping) {
      return this as unknown as MappingToken;
    }

    throw new TemplateTokenError(
      `Unexpected type '${this.typeName()}' encountered while reading '${objectDescription}'. The type '${tokenTypeName(
        TokenType.Mapping
      )}' was expected.`,
      this
    );
  }

  /**
   * Returns all tokens (depth first)
   * @param value The object to travese
   * @param omitKeys Whether to omit mapping keys
   */
  public static *traverse(
    value: TemplateToken,
    omitKeys?: boolean
  ): Generator<[parent: TemplateToken | undefined, token: TemplateToken, keyToken: TemplateToken | undefined], void> {
    yield [undefined, value, undefined];

    switch (value.templateTokenType) {
      case TokenType.Sequence:
      case TokenType.Mapping: {
        let state: TraversalState | undefined = new TraversalState(undefined, value);
        state = new TraversalState(state, value);
        while (state.parent) {
          if (state.moveNext(omitKeys ?? false)) {
            value = state.current as TemplateToken;
            yield [state.parent?.current, value, state.currentKey];

            switch (value.type) {
              case TokenType.Sequence:
              case TokenType.Mapping:
                state = new TraversalState(state, value);
                break;
            }
          } else {
            state = state.parent;
          }
        }
        break;
      }
    }
  }

  public toJSON(): SerializedToken {
    return undefined;
  }
}
