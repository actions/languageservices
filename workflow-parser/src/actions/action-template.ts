import {
  BasicExpressionToken,
  MappingToken,
  ScalarToken,
  StringToken,
  TemplateToken
} from "../templates/tokens/index.js";
import {TemplateContext} from "../templates/template-context.js";
import {isBoolean, isMapping, isScalar, isSequence, isString} from "../templates/tokens/type-guards.js";
import {ErrorPolicy} from "../model/convert.js";
import {Step} from "../model/workflow-template.js";
import {convertToIfCondition, validateRunsIfCondition} from "../model/converter/if-condition.js";

/**
 * Represents a parsed and converted action.yml file
 */
export type ActionTemplate = {
  name: string;
  description: string;
  author?: string;
  inputs?: ActionInputDefinition[];
  outputs?: ActionOutputDefinition[];
  runs: ActionRuns;
  branding?: ActionBranding;
};

/**
 * Represents an input definition from the action.yml inputs section.
 */
export type ActionInputDefinition = {
  id: string;
  description?: string;
  required?: boolean;
  default?: ScalarToken;
  deprecationMessage?: string;
};

/**
 * Represents an output definition from the action.yml outputs section.
 */
export type ActionOutputDefinition = {
  id: string;
  description?: string;
  value?: ScalarToken;
};

/**
 * Union type representing the different ways an action can be executed.
 */
export type ActionRuns = ActionRunsComposite | ActionRunsNode | ActionRunsDocker;

/**
 * Configuration for composite actions that execute a sequence of steps.
 */
export type ActionRunsComposite = {
  using: "composite";
  steps: Step[];
};

/**
 * Configuration for JavaScript actions that run in Node.js.
 */
export type ActionRunsNode = {
  using: "node12" | "node16" | "node20" | "node24";
  main: string;
  pre?: string;
  preIf?: string;
  post?: string;
  postIf?: string;
};

/**
 * Configuration for Docker container actions.
 */
export type ActionRunsDocker = {
  using: "docker";
  image: string;
  preEntrypoint?: string;
  preIf?: string;
  entrypoint?: string;
  postEntrypoint?: string;
  postIf?: string;
  args?: string[];
  env?: Record<string, string>;
};

/**
 * Branding configuration for displaying the action in the GitHub Marketplace.
 */
export type ActionBranding = {
  icon?: string;
  color?: string;
};

export type ActionTemplateConverterOptions = {
  /**
   * The error policy to use when converting the action.
   * By default, conversion will be skipped if there are errors in the {@link TemplateContext}.
   */
  errorPolicy?: ErrorPolicy;
};

/**
 * Converts a parsed action template token into a typed ActionTemplate
 */
export function convertActionTemplate(
  context: TemplateContext,
  root: TemplateToken,
  options?: ActionTemplateConverterOptions
): ActionTemplate {
  const result: Partial<ActionTemplate> = {};
  const errorPolicy = options?.errorPolicy ?? ErrorPolicy.ReturnErrorsOnly;

  // Skip conversion if there are parse errors (unless TryConversion is set)
  if (context.errors.getErrors().length > 0 && errorPolicy === ErrorPolicy.ReturnErrorsOnly) {
    return result as ActionTemplate;
  }

  if (!isMapping(root)) {
    context.error(root, new Error("Action must be a mapping"));
    return result as ActionTemplate;
  }

  for (const item of root) {
    const key = item.key.assertString("action key");

    switch (key.value) {
      case "name":
        if (isString(item.value)) {
          result.name = item.value.value;
        }
        break;

      case "description":
        if (isString(item.value)) {
          result.description = item.value.value;
        }
        break;

      case "author":
        if (isString(item.value)) {
          result.author = item.value.value;
        }
        break;

      case "inputs":
        result.inputs = convertInputs(context, item.value);
        break;

      case "outputs":
        result.outputs = convertOutputs(context, item.value);
        break;

      case "runs":
        result.runs = convertRuns(context, item.value);
        break;

      case "branding":
        result.branding = convertBranding(context, item.value);
        break;
    }
  }

  return result as ActionTemplate;
}

/**
 * Converts the inputs mapping token into an array of ActionInputDefinition objects.
 */
function convertInputs(context: TemplateContext, token: TemplateToken): ActionInputDefinition[] {
  const inputs: ActionInputDefinition[] = [];

  if (!isMapping(token)) {
    return inputs;
  }

  for (const item of token) {
    const id = item.key.assertString("input id").value;
    const input: ActionInputDefinition = {id};

    if (isMapping(item.value)) {
      for (const prop of item.value) {
        const propKey = prop.key.assertString("input property").value;

        switch (propKey) {
          case "description":
            if (isString(prop.value)) {
              input.description = prop.value.value;
            }
            break;

          case "required":
            if (isBoolean(prop.value)) {
              input.required = prop.value.value;
            } else if (isString(prop.value)) {
              input.required = prop.value.value === "true";
            }
            break;

          case "default":
            if (isScalar(prop.value)) {
              input.default = prop.value;
            }
            break;

          case "deprecationMessage":
            if (isString(prop.value)) {
              input.deprecationMessage = prop.value.value;
            }
            break;
        }
      }
    }

    inputs.push(input);
  }

  return inputs;
}

/**
 * Converts the outputs mapping token into an array of ActionOutputDefinition objects.
 */
function convertOutputs(context: TemplateContext, token: TemplateToken): ActionOutputDefinition[] {
  const outputs: ActionOutputDefinition[] = [];

  if (!isMapping(token)) {
    return outputs;
  }

  for (const item of token) {
    const id = item.key.assertString("output id").value;
    const output: ActionOutputDefinition = {id};

    if (isMapping(item.value)) {
      for (const prop of item.value) {
        const propKey = prop.key.assertString("output property").value;

        switch (propKey) {
          case "description":
            if (isString(prop.value)) {
              output.description = prop.value.value;
            }
            break;

          case "value":
            if (isScalar(prop.value)) {
              output.value = prop.value;
            }
            break;
        }
      }
    }

    outputs.push(output);
  }

  return outputs;
}

/**
 * Converts the runs mapping token into the appropriate ActionRuns variant based on the 'using' value.
 */
function convertRuns(context: TemplateContext, token: TemplateToken): ActionRuns {
  if (!isMapping(token)) {
    return {using: "composite", steps: []};
  }

  let using: string | undefined;
  let main: string | undefined;
  let image: string | undefined;
  let pre: string | undefined;
  let preIf: string | undefined;
  let post: string | undefined;
  let postIf: string | undefined;
  let preEntrypoint: string | undefined;
  let entrypoint: string | undefined;
  let postEntrypoint: string | undefined;
  let args: string[] | undefined;
  let env: Record<string, string> | undefined;
  let steps: Step[] = [];

  for (const item of token) {
    const key = item.key.assertString("runs property").value;

    switch (key) {
      case "using":
        if (isString(item.value)) {
          using = item.value.value;
        }
        break;

      case "main":
        if (isString(item.value)) {
          main = item.value.value;
        }
        break;

      case "image":
        if (isString(item.value)) {
          image = item.value.value;
        }
        break;

      case "pre":
        if (isString(item.value)) {
          pre = item.value.value;
        }
        break;

      case "pre-if":
        if (isString(item.value)) {
          preIf = validateRunsIfCondition(context, item.value, item.value.value);
        }
        break;

      case "post":
        if (isString(item.value)) {
          post = item.value.value;
        }
        break;

      case "post-if":
        if (isString(item.value)) {
          postIf = validateRunsIfCondition(context, item.value, item.value.value);
        }
        break;

      case "pre-entrypoint":
        if (isString(item.value)) {
          preEntrypoint = item.value.value;
        }
        break;

      case "entrypoint":
        if (isString(item.value)) {
          entrypoint = item.value.value;
        }
        break;

      case "post-entrypoint":
        if (isString(item.value)) {
          postEntrypoint = item.value.value;
        }
        break;

      case "args":
        if (isSequence(item.value)) {
          args = [];
          for (const arg of item.value) {
            if (isScalar(arg)) {
              args.push(arg.toString());
            }
          }
        }
        break;

      case "env":
        if (isMapping(item.value)) {
          env = {};
          for (const envItem of item.value) {
            const envKey = envItem.key.assertString("env key").value;
            if (isString(envItem.value)) {
              env[envKey] = envItem.value.value;
            }
          }
        }
        break;

      case "steps":
        steps = convertSteps(context, item.value);
        break;
    }
  }

  // Determine the type of runs configuration
  if (using === "composite") {
    return {using: "composite", steps};
  } else if (using === "docker" && image) {
    return {
      using: "docker",
      image,
      preEntrypoint,
      preIf,
      entrypoint,
      postEntrypoint,
      postIf,
      args,
      env
    };
  } else if ((using === "node12" || using === "node16" || using === "node20" || using === "node24") && main) {
    return {
      using,
      main,
      pre,
      preIf,
      post,
      postIf
    };
  }

  // Default fallback
  return {using: "composite", steps: []};
}

/**
 * Converts a steps sequence token into an array of Step objects for composite actions.
 */
function convertSteps(context: TemplateContext, token: TemplateToken): Step[] {
  const steps: Step[] = [];

  if (!isSequence(token)) {
    return steps;
  }

  for (const stepToken of token) {
    if (!isMapping(stepToken)) {
      continue;
    }

    const step = convertStep(context, stepToken);
    if (step) {
      steps.push(step);
    }
  }

  return steps;
}

/**
 * Converts a single step mapping token into a Step object.
 * Returns undefined if the step lacks both 'run' and 'uses' properties.
 */
function convertStep(context: TemplateContext, token: MappingToken): Step | undefined {
  let id: string | undefined;
  let name: ScalarToken | undefined;
  let ifCondition: BasicExpressionToken | undefined;
  let continueOnError: boolean | ScalarToken | undefined;
  let env: MappingToken | undefined;
  let run: ScalarToken | undefined;
  let uses: StringToken | undefined;

  for (const item of token) {
    const key = item.key.assertString("step property").value;

    switch (key) {
      case "id":
        if (isString(item.value)) {
          id = item.value.value;
        }
        break;

      case "name":
        if (isScalar(item.value)) {
          name = item.value;
        }
        break;

      case "if":
        ifCondition = convertToIfCondition(context, item.value);
        break;

      case "continue-on-error":
        if (isBoolean(item.value)) {
          continueOnError = item.value.value;
        } else if (isScalar(item.value)) {
          continueOnError = item.value;
        }
        break;

      case "env":
        if (isMapping(item.value)) {
          env = item.value;
        }
        break;

      case "run":
        if (isScalar(item.value)) {
          run = item.value;
        }
        break;

      case "uses":
        if (isString(item.value)) {
          uses = item.value;
        }
        break;

      // Note: shell, working-directory, and with are valid step properties
      // but not currently tracked in the Step model
    }
  }

  // Default if condition to success() like workflow steps
  const defaultIf = new BasicExpressionToken(undefined, undefined, "success()", undefined, undefined, undefined);

  // Produce Step type (same as workflow steps)
  if (run) {
    return {
      id: id || "",
      name,
      if: ifCondition || defaultIf,
      "continue-on-error": continueOnError,
      env,
      run
    };
  } else if (uses) {
    return {
      id: id || "",
      name,
      if: ifCondition || defaultIf,
      "continue-on-error": continueOnError,
      env,
      uses
    };
  }

  return undefined;
}

/**
 * Converts the branding mapping token into an ActionBranding object.
 */
function convertBranding(context: TemplateContext, token: TemplateToken): ActionBranding {
  const branding: ActionBranding = {};

  if (!isMapping(token)) {
    return branding;
  }

  for (const item of token) {
    const key = item.key.assertString("branding property").value;

    switch (key) {
      case "icon":
        if (isString(item.value)) {
          branding.icon = item.value.value;
        }
        break;

      case "color":
        if (isString(item.value)) {
          branding.color = item.value.value;
        }
        break;
    }
  }

  return branding;
}
