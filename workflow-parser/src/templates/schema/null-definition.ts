import {DEFINITION, NULL} from "../template-constants";
import {MappingToken, LiteralToken} from "../tokens";
import {DefinitionType} from "./definition-type";
import {ScalarDefinition} from "./scalar-definition";
import {TokenType} from "../tokens/types";

export class NullDefinition extends ScalarDefinition {
  public constructor(key: string, definition?: MappingToken) {
    super(key, definition);
    if (definition) {
      for (const definitionPair of definition) {
        const definitionKey = definitionPair.key.assertString(`${DEFINITION} key`);
        switch (definitionKey.value) {
          case NULL: {
            const mapping = definitionPair.value.assertMapping(`${DEFINITION} ${NULL}`);
            for (const mappingPair of mapping) {
              const mappingKey = mappingPair.key.assertString(`${DEFINITION} ${NULL} key`);
              switch (mappingKey.value) {
                default:
                  // throws
                  mappingKey.assertUnexpectedValue(`${DEFINITION} ${NULL} key`);
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
    return DefinitionType.Null;
  }

  public override isMatch(literal: LiteralToken): boolean {
    return literal.templateTokenType === TokenType.Null;
  }

  public override validate(): void {
    // no-op
  }
}
