import { TemplateContext } from "../../templates/template-context"
import {
  MappingToken,
  SequenceToken,
  StringToken,
  TemplateToken,
} from "../../templates/tokens"
import { isString } from "../../templates/tokens/type-guards"
import { Container, Credential } from "../workflow-template"

export function convertToJobContainer(
  context: TemplateContext,
  container: TemplateToken
): Container | undefined {
  let image: StringToken | undefined
  let env: MappingToken | undefined
  let ports: SequenceToken | undefined
  let volumes: SequenceToken | undefined
  let options: StringToken | undefined

  // Skip validation for expressions for now to match
  // behavior of the other parsers
  for (const [_, token, __] of TemplateToken.traverse(container)) {
    if (token.isExpression) {
      return
    }
  }

  if (isString(container)) {
    // Workflow uses shorthand syntax `container: image-name`
    image = container.assertString("container item")
    return { image: image }
  }

  const mapping = container.assertMapping("container item")
  if (mapping)
    for (const item of mapping) {
      const key = item.key.assertString("container item key")
      const value = item.value

      switch (key.value) {
        case "image":
          image = value.assertString("container image")
          break
        case "credentials":
          convertToJobCredentials(context, value)
          break
        case "env":
          env = value.assertMapping("container env")
          for (const envItem of env) {
            envItem.key.assertString("container env value")
          }
          break
        case "ports":
          ports = value.assertSequence("container ports")
          for (const port of ports) {
            port.assertString("container port")
          }
          break
        case "volumes":
          volumes = value.assertSequence("container volumes")
          for (const volume of volumes) {
            volume.assertString("container volume")
          }
          break
        case "options":
          options = value.assertString("container options")
          break
        default:
          context.error(key, `Unexpected container item key: ${key.value}`)
      }
    }

  if (!image) {
    context.error(container, "Container image cannot be empty")
  } else {
    return { image, env, ports, volumes, options }
  }
}

export function convertToJobServices(
  context: TemplateContext,
  services: TemplateToken
): Container[] | undefined {
  const serviceList: Container[] = []

  const mapping = services.assertMapping("services")
  for (const service of mapping) {
    service.key.assertString("service key")
    const container = convertToJobContainer(context, service.value)
    if (container) {
      serviceList.push(container)
    }
  }
  return serviceList
}

function convertToJobCredentials(
  context: TemplateContext,
  value: TemplateToken
): Credential | undefined {
  const mapping = value.assertMapping("credentials")

  let username: StringToken | undefined
  let password: StringToken | undefined

  for (const item of mapping) {
    const key = item.key.assertString("credentials item")
    const value = item.value

    switch (key.value) {
      case "username":
        username = value.assertString("credentials username")
        break
      case "password":
        password = value.assertString("credentials password")
        break
      default:
        context.error(key, `credentials key ${key.value}`)
    }
  }

  return { username, password }
}
