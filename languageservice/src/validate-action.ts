/**
 * Validation for action.yml / action.yaml manifest files
 */

import {isMapping} from "@actions/workflow-parser";
import {isActionStep} from "@actions/workflow-parser/model/type-guards";
import {ErrorPolicy} from "@actions/workflow-parser/model/convert";
import {MappingToken} from "@actions/workflow-parser/templates/tokens/mapping-token";
import {SequenceToken} from "@actions/workflow-parser/templates/tokens/sequence-token";
import {TemplateToken} from "@actions/workflow-parser/templates/tokens/template-token";
import {File} from "@actions/workflow-parser/workflows/file";
import {TextDocument} from "vscode-languageserver-textdocument";
import {Diagnostic, DiagnosticSeverity} from "vscode-languageserver-types";
import {error} from "./log.js";
import {mapRange} from "./utils/range.js";
import {getOrConvertActionTemplate, getOrParseAction} from "./utils/workflow-cache.js";
import {validateActionReference} from "./validate-action-reference.js";
import {ValidationConfig} from "./validate.js";

/**
 * Valid keys for each action type under the `runs:` section.
 * Source: https://github.com/actions/runner/blob/main/src/Runner.Worker/ActionManifestManager.cs
 */
const NODE_KEYS = new Set(["using", "main", "pre", "post", "pre-if", "post-if"]);
const COMPOSITE_KEYS = new Set(["using", "steps"]);
const DOCKER_KEYS = new Set([
  "using",
  "image",
  "args",
  "env",
  "entrypoint",
  "pre-entrypoint",
  "pre-if",
  "post-entrypoint",
  "post-if"
]);

/**
 * Required keys for each action type (besides 'using').
 */
const NODE_REQUIRED_KEYS = ["main"];
const COMPOSITE_REQUIRED_KEYS = ["steps"];
const DOCKER_REQUIRED_KEYS = ["image"];

/**
 * Validates an action.yml file
 *
 * @param textDocument Document to validate
 * @param config Optional validation configuration for action metadata provider
 * @returns Array of diagnostics
 */
export async function validateAction(textDocument: TextDocument, config?: ValidationConfig): Promise<Diagnostic[]> {
  const file: File = {
    name: textDocument.uri,
    content: textDocument.getText()
  };

  const diagnostics: Diagnostic[] = [];

  try {
    // Parse and validate the action.yml against the schema
    const result = getOrParseAction(file, textDocument.uri);
    if (!result) {
      return [];
    }

    // Map parser errors to diagnostics
    for (const err of result.context.errors.getErrors()) {
      const range = mapRange(err.range);

      // Determine severity based on error type
      let severity: DiagnosticSeverity = DiagnosticSeverity.Error;

      // Treat deprecation warnings as warnings
      if (err.rawMessage.includes("deprecated")) {
        severity = DiagnosticSeverity.Warning;
      }

      diagnostics.push({
        message: err.rawMessage,
        range,
        severity
      });
    }

    // Validate runs key combinations based on using type
    if (result.value) {
      const runsKeyDiagnostics = validateRunsKeys(result.value);
      diagnostics.push(...runsKeyDiagnostics);
    }

    // Validate composite action steps if we have a parsed result
    if (result.value) {
      const template = getOrConvertActionTemplate(result.context, result.value, textDocument.uri, {
        errorPolicy: ErrorPolicy.TryConversion
      });

      // Only composite actions have steps to validate
      if (template?.runs?.using === "composite") {
        const steps = template.runs.steps ?? [];

        // Find the steps sequence token from the raw parsed result
        const stepsSequence = findStepsSequence(result.value);
        if (stepsSequence) {
          // Validate each action step
          for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const stepToken = stepsSequence.get(i);

            // Validate action references (inputs, required fields) for uses steps
            if (isActionStep(step) && isMapping(stepToken)) {
              await validateActionReference(diagnostics, stepToken, step, config);
            }
          }
        }
      }
    }
  } catch (e) {
    error(`Unhandled error while validating action file: ${(e as Error).message}`);
  }

  return diagnostics;
}

/**
 * Find the steps sequence token from the raw action template.
 * Traverses the token tree looking for the "composite-steps" definition.
 */
function findStepsSequence(root: TemplateToken): SequenceToken | undefined {
  for (const [, token] of TemplateToken.traverse(root)) {
    if (token.definition?.key === "composite-steps" && token instanceof SequenceToken) {
      return token;
    }
  }
  return undefined;
}

/**
 * Validates that the keys under `runs:` are valid for the specified `using:` type.
 */
function validateRunsKeys(root: TemplateToken): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Find the runs mapping from the root
  let runsMapping: MappingToken | undefined;
  if (root instanceof MappingToken) {
    for (let i = 0; i < root.count; i++) {
      const {key, value} = root.get(i);
      if (key.toString().toLowerCase() === "runs" && value instanceof MappingToken) {
        runsMapping = value;
        break;
      }
    }
  }
  if (!runsMapping) {
    return diagnostics;
  }

  // Get the using value from the runs mapping
  let usingValue: string | undefined;
  for (let i = 0; i < runsMapping.count; i++) {
    const {key, value} = runsMapping.get(i);
    if (key.toString().toLowerCase() === "using") {
      usingValue = value.toString();
      break;
    }
  }
  if (!usingValue) {
    return diagnostics; // No using value, let schema validation handle it
  }

  // Determine allowed keys, required keys, and action type name
  let allowedKeys: Set<string>;
  let requiredKeys: string[];
  let actionType: string;

  if (usingValue.match(/^node\d+$/i)) {
    allowedKeys = NODE_KEYS;
    requiredKeys = NODE_REQUIRED_KEYS;
    actionType = "Node.js";
  } else if (usingValue.toLowerCase() === "composite") {
    allowedKeys = COMPOSITE_KEYS;
    requiredKeys = COMPOSITE_REQUIRED_KEYS;
    actionType = "composite";
  } else if (usingValue.toLowerCase() === "docker") {
    allowedKeys = DOCKER_KEYS;
    requiredKeys = DOCKER_REQUIRED_KEYS;
    actionType = "Docker";
  } else {
    return diagnostics; // Unknown type, let schema validation handle it
  }

  // Get all present keys
  const presentKeys = new Set<string>();
  for (let i = 0; i < runsMapping.count; i++) {
    const {key} = runsMapping.get(i);
    presentKeys.add(key.toString().toLowerCase());
  }

  // Check for invalid keys
  for (let i = 0; i < runsMapping.count; i++) {
    const {key} = runsMapping.get(i);
    const keyStr = key.toString().toLowerCase();

    if (!allowedKeys.has(keyStr)) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: mapRange(key.range),
        message: `'${key.toString()}' is not valid for ${actionType} actions (using: ${usingValue})`
      });
    }
  }

  // Check for missing required keys
  for (const requiredKey of requiredKeys) {
    if (!presentKeys.has(requiredKey)) {
      // Find the 'using' key to report the error location
      let usingKeyRange = runsMapping.range;
      for (let i = 0; i < runsMapping.count; i++) {
        const {key} = runsMapping.get(i);
        if (key.toString().toLowerCase() === "using") {
          usingKeyRange = key.range;
          break;
        }
      }

      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: mapRange(usingKeyRange),
        message: `'${requiredKey}' is required for ${actionType} actions (using: ${usingValue})`
      });
    }
  }

  return diagnostics;
}
