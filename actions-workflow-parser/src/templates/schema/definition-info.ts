import { TemplateSchema } from "."
import { Definition } from "./definition"
import { DefinitionType } from "./definition-type"
import { ScalarDefinition } from "./scalar-definition"

export class DefinitionInfo {
  private readonly _schema: TemplateSchema
  public readonly isDefinitionInfo = true
  public readonly definition: Definition
  public readonly allowedContext: string[]

  public constructor(schema: TemplateSchema, name: string)
  public constructor(parent: DefinitionInfo, name: string)
  public constructor(parent: DefinitionInfo, definition: Definition)
  public constructor(
    schemaOrParent: TemplateSchema | DefinitionInfo,
    nameOrDefinition: string | Definition
  ) {
    const parent: DefinitionInfo | undefined =
      (schemaOrParent as DefinitionInfo | undefined)?.isDefinitionInfo === true
        ? (schemaOrParent as DefinitionInfo)
        : undefined
    this._schema =
      parent === undefined ? (schemaOrParent as TemplateSchema) : parent._schema

    // Lookup the definition if a key was passed in
    this.definition =
      typeof nameOrDefinition === "string"
        ? this._schema.getDefinition(nameOrDefinition)
        : nameOrDefinition

    // Record allowed context
    if (this.definition.readerContext.length > 0) {
      this.allowedContext = []

      // Copy parent allowed context
      const upperSeen: { [upper: string]: boolean } = {}
      for (const context of parent?.allowedContext ?? []) {
        this.allowedContext.push(context)
        upperSeen[context.toUpperCase()] = true
      }

      // Append context if unseen
      for (const context of this.definition.readerContext) {
        const upper = context.toUpperCase()
        if (!upperSeen[upper]) {
          this.allowedContext.push(context)
          upperSeen[upper] = true
        }
      }
    } else {
      this.allowedContext = parent?.allowedContext ?? []
    }
  }

  public getScalarDefinitions(): ScalarDefinition[] {
    return this._schema.getScalarDefinitions(this.definition)
  }

  public getDefinitionsOfType(type: DefinitionType): Definition[] {
    return this._schema.getDefinitionsOfType(this.definition, type)
  }
}
