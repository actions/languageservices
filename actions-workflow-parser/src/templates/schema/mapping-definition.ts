import { TemplateSchema } from "./template-schema"
import {
  DEFINITION,
  MAPPING,
  PROPERTIES,
  LOOSE_KEY_TYPE,
  LOOSE_VALUE_TYPE,
} from "../template-constants"
import { MappingToken } from "../tokens"
import { Definition } from "./definition"
import { DefinitionType } from "./definition-type"
import { PropertyDefinition } from "./property-definition"

export class MappingDefinition extends Definition {
  public readonly properties: { [key: string]: PropertyDefinition } = {}
  public looseKeyType = ""
  public looseValueType = ""

  public constructor(key: string, definition?: MappingToken) {
    super(key, definition)
    if (definition) {
      for (const definitionPair of definition) {
        const definitionKey = definitionPair.key.assertString(
          `${DEFINITION} key`
        )
        switch (definitionKey.value) {
          case MAPPING: {
            const mapping = definitionPair.value.assertMapping(
              `${DEFINITION} ${MAPPING}`
            )
            for (const mappingPair of mapping) {
              const mappingKey = mappingPair.key.assertString(
                `${DEFINITION} ${MAPPING} key`
              )
              switch (mappingKey.value) {
                case PROPERTIES: {
                  const properties = mappingPair.value.assertMapping(
                    `${DEFINITION} ${MAPPING} ${PROPERTIES}`
                  )
                  for (const propertiesPair of properties) {
                    const propertyName = propertiesPair.key.assertString(
                      `${DEFINITION} ${MAPPING} ${PROPERTIES} key`
                    )
                    this.properties[propertyName.value] =
                      new PropertyDefinition(propertiesPair.value)
                  }
                  break
                }
                case LOOSE_KEY_TYPE: {
                  const looseKeyType = mappingPair.value.assertString(
                    `${DEFINITION} ${MAPPING} ${LOOSE_KEY_TYPE}`
                  )
                  this.looseKeyType = looseKeyType.value
                  break
                }
                case LOOSE_VALUE_TYPE: {
                  const looseValueType = mappingPair.value.assertString(
                    `${DEFINITION} ${MAPPING} ${LOOSE_VALUE_TYPE}`
                  )
                  this.looseValueType = looseValueType.value
                  break
                }
                default:
                  // throws
                  mappingKey.assertUnexpectedValue(
                    `${DEFINITION} ${MAPPING} key`
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
    return DefinitionType.Mapping
  }

  public override validate(schema: TemplateSchema, name: string): void {
    // Lookup loose key type
    if (this.looseKeyType) {
      schema.getDefinition(this.looseKeyType)

      // Lookup loose value type
      if (this.looseValueType) {
        schema.getDefinition(this.looseValueType)
      } else {
        throw new Error(
          `Property '${LOOSE_KEY_TYPE}' is defined but '${LOOSE_VALUE_TYPE}' is not defined on '${name}'`
        )
      }
    }
    // Otherwise validate loose value type not be defined
    else if (this.looseValueType) {
      throw new Error(
        `Property '${LOOSE_VALUE_TYPE}' is defined but '${LOOSE_KEY_TYPE}' is not defined on '${name}'`
      )
    }

    // Lookup each property
    for (const propertyName of Object.keys(this.properties)) {
      const propertyDef = this.properties[propertyName]
      if (!propertyDef.type) {
        throw new Error(
          `Type not specified for the property '${propertyName}' on '${name}'`
        )
      }

      schema.getDefinition(propertyDef.type)
    }
  }
}
