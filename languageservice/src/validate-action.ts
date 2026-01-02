/**
 * Validation for action.yml / action.yaml manifest files
 */

import {isMapping} from "@actions/workflow-parser";
import {isActionStep} from "@actions/workflow-parser/model/type-guards";
import {ErrorPolicy} from "@actions/workflow-parser/model/convert";
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
