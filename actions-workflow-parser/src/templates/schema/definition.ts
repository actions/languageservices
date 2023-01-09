import { CONTEXT, DEFINITION, DESCRIPTION } from "../template-constants"
import { MappingToken } from "../tokens"
import { DefinitionType } from "./definition-type"
import { TemplateSchema } from "./template-schema"

/**
 * Defines the allowable schema for a user defined type
 */
export abstract class Definition {
  /**
   * Used by the template reader to determine allowed expression values and functions.
   * Also used by the template reader to validate function min/max parameters.
   */
  public readonly readerContext: string[] = []

  /**
   * Used by the template evaluator to determine allowed expression values and functions.
   * The min/max parameter info is omitted.
   */
  public readonly evaluatorContext: string[] = []

  // A key to uniquely identify a definition
  public readonly key: string

  public readonly description: string | undefined

  public constructor(key: string, definition?: MappingToken) {
    this.key = key
    if (definition) {
      for (let i = 0; i < definition.count; ) {
        const definitionKey = definition
          .get(i)
          .key.assertString(`${DEFINITION} key`)
        switch (definitionKey.value) {
          case CONTEXT: {
            const context = definition
              .get(i)
              .value.assertSequence(`${DEFINITION} ${CONTEXT}`)
            definition.remove(i)
            const seenReaderContext: { [key: string]: boolean } = {}
            const seenEvaluatorContext: { [key: string]: boolean } = {}
            for (const item of context) {
              const itemStr = item.assertString(`${CONTEXT} item`).value
              const upperItemStr = itemStr.toUpperCase()
              if (seenReaderContext[upperItemStr]) {
                throw new Error(`Duplicate context item '${itemStr}'`)
              }
              seenReaderContext[upperItemStr] = true
              this.readerContext.push(itemStr)

              // Remove min/max parameter info
              const paramIndex = itemStr.indexOf("(")
              const modifiedItemStr =
                paramIndex > 0
                  ? itemStr.substr(0, paramIndex + 1) + ")"
                  : itemStr
              const upperModifiedItemStr = modifiedItemStr.toUpperCase()
              if (seenEvaluatorContext[upperModifiedItemStr]) {
                throw new Error(`Duplicate context item '${modifiedItemStr}'`)
              }
              seenEvaluatorContext[upperModifiedItemStr] = true
              this.evaluatorContext.push(modifiedItemStr)
            }

            break
          }
          case DESCRIPTION: {
            const value = definition.get(i).value
            this.description = value.assertString(DESCRIPTION).value
            definition.remove(i)
            break
          }
          default: {
            i++
            break
          }
        }
      }
    }
  }

  public abstract get definitionType(): DefinitionType

  public abstract validate(schema: TemplateSchema, name: string): void
}
