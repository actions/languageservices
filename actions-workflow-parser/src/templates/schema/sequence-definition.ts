import { DEFINITION, SEQUENCE, ITEM_TYPE } from "../template-constants"
import { MappingToken } from "../tokens"
import { Definition } from "./definition"
import { DefinitionType } from "./definition-type"
import { TemplateSchema } from "./template-schema"

export class SequenceDefinition extends Definition {
  public itemType = ""

  public constructor(key: string, definition?: MappingToken) {
    super(key, definition)
    if (definition) {
      for (const definitionPair of definition) {
        const definitionKey = definitionPair.key.assertString(
          `${DEFINITION} key`
        )
        switch (definitionKey.value) {
          case SEQUENCE: {
            const mapping = definitionPair.value.assertMapping(
              `${DEFINITION} ${SEQUENCE}`
            )
            for (const mappingPair of mapping) {
              const mappingKey = mappingPair.key.assertString(
                `${DEFINITION} ${SEQUENCE} key`
              )
              switch (mappingKey.value) {
                case ITEM_TYPE: {
                  const itemType = mappingPair.value.assertString(
                    `${DEFINITION} ${SEQUENCE} ${ITEM_TYPE}`
                  )
                  this.itemType = itemType.value
                  break
                }
                default:
                  // throws
                  mappingKey.assertUnexpectedValue(
                    `${DEFINITION} ${SEQUENCE} key`
                  )
                  break
              }
            }
            break
          }
          default:
            definitionKey.assertUnexpectedValue(`${DEFINITION} key`) // throws
        }
      }
    }
  }

  public override get definitionType(): DefinitionType {
    return DefinitionType.Sequence
  }

  public override validate(schema: TemplateSchema, name: string): void {
    if (!this.itemType) {
      throw new Error(`'${name}' does not defined '${ITEM_TYPE}'`)
    }

    // Lookup item type
    schema.getDefinition(this.itemType)
  }
}
