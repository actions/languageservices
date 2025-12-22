import {CONSTANT, DEFINITION, IGNORE_CASE, IS_EXPRESSION, REQUIRE_NON_EMPTY, STRING} from "../template-constants.js";
import {LiteralToken, MappingToken, StringToken} from "../tokens/index.js";
import {TokenType} from "../tokens/types.js";
import {DefinitionType} from "./definition-type.js";
import {ScalarDefinition} from "./scalar-definition.js";

export class StringDefinition extends ScalarDefinition {
  public constant = "";
  public ignoreCase = false;
  public requireNonEmpty = false;
  public isExpression = false;

  public constructor(key: string, definition?: MappingToken) {
    super(key, definition);
    if (definition) {
      for (const definitionPair of definition) {
        const definitionKey = definitionPair.key.assertString(`${DEFINITION} key`);
        switch (definitionKey.value) {
          case STRING: {
            const mapping = definitionPair.value.assertMapping(`${DEFINITION} ${STRING}`);
            for (const mappingPair of mapping) {
              const mappingKey = mappingPair.key.assertString(`${DEFINITION} ${STRING} key`);
              switch (mappingKey.value) {
                case CONSTANT: {
                  const constantStringToken = mappingPair.value.assertString(`${DEFINITION} ${STRING} ${CONSTANT}`);
                  this.constant = constantStringToken.value;
                  break;
                }
                case IGNORE_CASE: {
                  const ignoreCaseBooleanToken = mappingPair.value.assertBoolean(
                    `${DEFINITION} ${STRING} ${IGNORE_CASE}`
                  );
                  this.ignoreCase = ignoreCaseBooleanToken.value;
                  break;
                }
                case REQUIRE_NON_EMPTY: {
                  const requireNonEmptyBooleanToken = mappingPair.value.assertBoolean(
                    `${DEFINITION} ${STRING} ${REQUIRE_NON_EMPTY}`
                  );
                  this.requireNonEmpty = requireNonEmptyBooleanToken.value;
                  break;
                }
                case IS_EXPRESSION: {
                  const isExpressionToken = mappingPair.value.assertBoolean(`${DEFINITION} ${STRING} ${IS_EXPRESSION}`);
                  this.isExpression = isExpressionToken.value;
                  break;
                }
                default:
                  // throws
                  mappingKey.assertUnexpectedValue(`${DEFINITION} ${STRING} key`);
                  break;
              }
            }
            break;
          }
          default:
            definitionKey.assertUnexpectedValue(`${DEFINITION} key`); // throws
        }
      }
    }
  }

  public override get definitionType(): DefinitionType {
    return DefinitionType.String;
  }

  public override isMatch(literal: LiteralToken): boolean {
    if (literal.templateTokenType === TokenType.String) {
      const value = (literal as StringToken).value;
      if (this.constant) {
        return this.ignoreCase ? this.constant.toUpperCase() === value.toUpperCase() : this.constant === value;
      } else if (this.requireNonEmpty) {
        return !!value;
      } else {
        return true;
      }
    }

    return false;
  }

  public override validate(): void {
    if (this.constant && this.requireNonEmpty) {
      throw new Error(`Properties '${CONSTANT}' and '${REQUIRE_NON_EMPTY}' cannot both be set`);
    }
  }
}
