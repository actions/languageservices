import {FeatureFlags} from "@actions/expressions";
import {TemplateContext} from "../../templates/template-context.js";
import {MappingToken, SequenceToken, StringToken, TemplateToken} from "../../templates/tokens/index.js";
import {isString} from "../../templates/tokens/type-guards.js";
import {Container, Credential} from "../workflow-template.js";

function getFeatureFlags(context: TemplateContext): FeatureFlags | undefined {
  return context.state["featureFlags"] as FeatureFlags | undefined;
}

const DOCKER_URI_PREFIX = "docker://";

function isEmptyImage(value: string): boolean {
  const trimmed = value.startsWith(DOCKER_URI_PREFIX) ? value.substring(DOCKER_URI_PREFIX.length) : value;
  return trimmed.length === 0;
}

export function convertToJobContainer(
  context: TemplateContext,
  container: TemplateToken,
  isServiceContainer = false
): Container | undefined {
  // Feature flag guard — use legacy implementation when flag is off
  if (!getFeatureFlags(context)?.isEnabled("containerImageValidation")) {
    return convertToJobContainerLegacy(context, container);
  }

  if (container.isExpression) {
    return;
  }

  // Shorthand form
  if (isString(container)) {
    const image = container.assertString("container item");
    if (!image || image.value.length === 0) {
      if (isServiceContainer) {
        context.error(container, "Container image cannot be empty");
      }
      return;
    }

    if (isEmptyImage(image.value)) {
      context.error(container, "Container image cannot be empty");
      return;
    }

    return {image};
  }

  // Mapping form
  const mapping = container.assertMapping("container item");
  if (!mapping) {
    return;
  }

  let image: StringToken | undefined;
  let env: MappingToken | undefined;
  let ports: SequenceToken | undefined;
  let volumes: SequenceToken | undefined;
  let options: StringToken | undefined;
  let credentials: Credential | undefined;
  let hasExpressionKey = false;
  let hasExpression = false;

  for (const item of mapping) {
    if (item.key.isExpression) {
      hasExpressionKey = true;
      continue;
    }

    const key = item.key.assertString("container item key");

    switch (key.value) {
      case "image":
        if (item.value.isExpression) {
          hasExpression = true;
          break;
        }
        image = item.value.assertString("container image");
        break;
      case "credentials":
        if (!item.value.isExpression) {
          credentials = convertCredentials(context, item.value);
        }
        break;
      case "env":
        if (!item.value.isExpression) {
          env = item.value.assertMapping("container env");
        }
        break;
      case "ports":
        if (!item.value.isExpression) {
          ports = item.value.assertSequence("container ports");
        }
        break;
      case "volumes":
        if (!item.value.isExpression) {
          volumes = item.value.assertSequence("container volumes");
        }
        break;
      case "options":
        if (!item.value.isExpression) {
          options = item.value.assertString("container options");
        }
        break;
      default:
        context.error(key, `Unexpected container item key: ${key.value}`);
    }
  }

  // Validate image
  if (image) {
    if (isEmptyImage(image.value)) {
      context.error(image, "Container image cannot be empty");
      return;
    }
    return {image, credentials, env, ports, volumes, options};
  }

  // No image key — skip error if expression keys could provide one
  if (!hasExpressionKey && !hasExpression) {
    context.error(container, "Container image cannot be empty");
  }
}

export function convertToJobServices(context: TemplateContext, services: TemplateToken): Container[] | undefined {
  // Feature flag guard — use legacy implementation when flag is off
  if (!getFeatureFlags(context)?.isEnabled("containerImageValidation")) {
    return convertToJobServicesLegacy(context, services);
  }

  if (services.isExpression) {
    return;
  }

  const serviceList: Container[] = [];
  const mapping = services.assertMapping("services");

  for (const service of mapping) {
    if (service.key.isExpression) {
      continue;
    }

    service.key.assertString("service key");
    const container = convertToJobContainer(context, service.value, true);
    if (container) {
      serviceList.push(container);
    }
  }

  return serviceList;
}

function convertCredentials(context: TemplateContext, value: TemplateToken): Credential | undefined {
  const mapping = value.assertMapping("credentials");
  if (!mapping) {
    return;
  }

  let username: StringToken | undefined;
  let password: StringToken | undefined;

  for (const item of mapping) {
    if (item.key.isExpression) {
      continue;
    }

    const key = item.key.assertString("credentials item");
    if (item.value.isExpression) {
      continue;
    }

    switch (key.value) {
      case "username":
        username = item.value.assertString("credentials username");
        break;
      case "password":
        password = item.value.assertString("credentials password");
        break;
      default:
        context.error(key, `credentials key ${key.value}`);
    }
  }

  return {username, password};
}

// ===== Legacy implementations (remove when containerImageValidation graduates) =====

function convertToJobContainerLegacy(context: TemplateContext, container: TemplateToken): Container | undefined {
  let image: StringToken | undefined;
  let env: MappingToken | undefined;
  let ports: SequenceToken | undefined;
  let volumes: SequenceToken | undefined;
  let options: StringToken | undefined;

  for (const [, token] of TemplateToken.traverse(container)) {
    if (token.isExpression) {
      return;
    }
  }

  if (isString(container)) {
    image = container.assertString("container item");
    return {image: image};
  }

  const mapping = container.assertMapping("container item");
  if (mapping)
    for (const item of mapping) {
      const key = item.key.assertString("container item key");
      const value = item.value;

      switch (key.value) {
        case "image":
          image = value.assertString("container image");
          break;
        case "credentials":
          convertToJobCredentialsLegacy(context, value);
          break;
        case "env":
          env = value.assertMapping("container env");
          for (const envItem of env) {
            envItem.key.assertString("container env value");
          }
          break;
        case "ports":
          ports = value.assertSequence("container ports");
          for (const port of ports) {
            port.assertString("container port");
          }
          break;
        case "volumes":
          volumes = value.assertSequence("container volumes");
          for (const volume of volumes) {
            volume.assertString("container volume");
          }
          break;
        case "options":
          options = value.assertString("container options");
          break;
        default:
          context.error(key, `Unexpected container item key: ${key.value}`);
      }
    }

  if (!image) {
    context.error(container, "Container image cannot be empty");
  } else {
    return {image, env, ports, volumes, options};
  }
}

function convertToJobServicesLegacy(context: TemplateContext, services: TemplateToken): Container[] | undefined {
  const serviceList: Container[] = [];

  const mapping = services.assertMapping("services");
  for (const service of mapping) {
    service.key.assertString("service key");
    const container = convertToJobContainerLegacy(context, service.value);
    if (container) {
      serviceList.push(container);
    }
  }
  return serviceList;
}

function convertToJobCredentialsLegacy(context: TemplateContext, value: TemplateToken): Credential | undefined {
  const mapping = value.assertMapping("credentials");

  let username: StringToken | undefined;
  let password: StringToken | undefined;

  for (const item of mapping) {
    const key = item.key.assertString("credentials item");
    const value = item.value;

    switch (key.value) {
      case "username":
        username = value.assertString("credentials username");
        break;
      case "password":
        password = value.assertString("credentials password");
        break;
      default:
        context.error(key, `credentials key ${key.value}`);
    }
  }

  return {username, password};
}
