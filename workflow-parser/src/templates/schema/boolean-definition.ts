import {DEFINITION, BOOLEAN} from "../template-constants";
import {MappingToken, LiteralToken} from "../tokens";
import {TokenType} from "../tokens/types";
import {DefinitionType} from "./definition-type";
import {ScalarDefinition} from "./scalar-definition";

export class BooleanDefinition extends ScalarDefinition {
  public constructor(key: string, definition?: MappingToken) {
    super(key, definition);
    if (definition) {
      for (const definitionPair of definition) {
        const definitionKey = definitionPair.key.assertString(`${DEFINITION} key`);
        switch (definitionKey.value) {
          case BOOLEAN: {
            const mapping = definitionPair.value.assertMapping(`${DEFINITION} ${BOOLEAN}`);
            for (const mappingPair of mapping) {
              const mappingKey = mappingPair.key.assertString(`${DEFINITION} ${BOOLEAN} key`);
              switch (mappingKey.value) {
                default:
                  // throws
                  mappingKey.assertUnexpectedValue(`${DEFINITION} ${BOOLEAN} key`);
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
    return DefinitionType.Boolean;
  }

  public override isMatch(literal: LiteralToken): boolean {
    return literal.templateTokenType === TokenType.Boolean;
  }

  public override validate(): void {
    // no-op
  }
}
