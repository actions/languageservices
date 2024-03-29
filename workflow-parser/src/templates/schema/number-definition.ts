import {DEFINITION, NUMBER} from "../template-constants";
import {MappingToken, LiteralToken} from "../tokens";
import {DefinitionType} from "./definition-type";
import {ScalarDefinition} from "./scalar-definition";
import {TokenType} from "../tokens/types";

export class NumberDefinition extends ScalarDefinition {
  public constructor(key: string, definition?: MappingToken) {
    super(key, definition);
    if (definition) {
      for (const definitionPair of definition) {
        const definitionKey = definitionPair.key.assertString(`${DEFINITION} key`);
        switch (definitionKey.value) {
          case NUMBER: {
            const mapping = definitionPair.value.assertMapping(`${DEFINITION} ${NUMBER}`);
            for (const mappingPair of mapping) {
              const mappingKey = mappingPair.key.assertString(`${DEFINITION} ${NUMBER} key`);
              switch (mappingKey.value) {
                default:
                  // throws
                  mappingKey.assertUnexpectedValue(`${DEFINITION} ${NUMBER} key`);
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
    return DefinitionType.Number;
  }

  public override isMatch(literal: LiteralToken): boolean {
    return literal.templateTokenType === TokenType.Number;
  }

  public override validate(): void {
    // no-op
  }
}
