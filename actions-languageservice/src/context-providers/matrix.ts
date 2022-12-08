import {data} from "@github/actions-expressions";
import {isBasicExpression, isMapping, isSequence, isString} from "@github/actions-workflow-parser";
import {KeyValuePair} from "@github/actions-workflow-parser/templates/tokens/key-value-pair";
import {MappingToken} from "@github/actions-workflow-parser/templates/tokens/mapping-token";
import {SequenceToken} from "@github/actions-workflow-parser/templates/tokens/sequence-token";
import {WorkflowContext} from "../context/workflow-context";
import {ContextValue} from "./default";

export function getMatrixContext(workflowContext: WorkflowContext, allowPartialContext: boolean): ContextValue {
  // https://docs.github.com/en/actions/learn-github-actions/contexts#matrix-context
  const strategy = workflowContext.job?.strategy;
  if (!strategy || !isMapping(strategy)) {
    return new data.Dictionary();
  }

  const matrix = strategy.find("matrix");
  if (!matrix || !isMapping(matrix)) {
    // Matrix could be an expression, so there's no context we can provide
    return new data.Null();
  }

  const properties = matrixProperties(matrix, allowPartialContext);
  if (!properties) {
    // Matrix included an expression, so there's no context we can provide
    return new data.Null();
  }

  const d = new data.Dictionary();
  for (const [key, value] of properties) {
    if (value === undefined) {
      d.add(key, new data.Null());
      continue;
    }

    const a = new data.Array();
    for (const v of value) {
      a.add(new data.StringData(v));
    }
    d.add(key, a);
  }

  return d;
}

/**
 * https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstrategymatrix
 * A matrix property can come from:
 *   - An explicit matrix property key
 *   - A configuration included via the "include" property
 *
 * By definition, "exclude" can't add new keys to the matrix.
 * Additionally, "include" and "exclude are not properties of the matrix
 * If the matrix or "include" is an expression, we can't know the keys
 *
 * Examples:
 * 1. Basic matrix
 *   matrix:
 *     version: [10, 12, 14]
 *     os: [ubuntu-latest, windows-latest]
 *
 *   Keys: version, os
 *
 * 2. Matrix with "include"
 *   matrix:
 *     version: [10, 12, 14]
 *     os: [ubuntu-latest, windows-latest]
 *     include:
 *       - version: 10
 *         os: macos-latest
 *
 *   Keys: version, os
 *
 * 3. Matrix with new properties in "include"
 *   matrix:
 *     include:
 *     - site: "production"
 *       datacenter: "site-a"
 *     - site: "staging"
 *       datacenter: "site-b"
 *
 *   Keys: site, datacenter
 *
 * 4. Matrix with "exclude"
 *   matrix:
 *     os: [macos-latest, windows-latest]
 *     version: [12, 14, 16]
 *     environment: [staging, production]
 *     exclude:
 *       - os: macos-latest
 *         version: 12
 *         environment: production
 *       - os: windows-latest
 *         version: 16
 *
 *  Keys: os, version, environment
 */
function matrixProperties(
  matrix: MappingToken,
  allowPartialContext: boolean
): Map<string, Set<string> | undefined> | undefined {
  const properties = new Map<string, Set<string> | undefined>();

  let include: SequenceToken | undefined;

  for (let i = 0; i < matrix.count; i++) {
    const pair = matrix.get(i);
    if (!isString(pair.key)) {
      continue;
    }

    const key = pair.key.value;
    switch (key) {
      case "include":
        // If "include" is an expression, we can't know the full properties of the matrix
        if (isBasicExpression(pair.value) || !isSequence(pair.value)) {
          if (!allowPartialContext) {
            return;
          } else {
            continue;
          }
        }
        include = pair.value;
        break;

      case "exclude":
        break;
      default:
        if (!isSequence(pair.value)) {
          properties.set(key, undefined);
          continue;
        }

        const values = new Set<string>();
        for (let j = 0; j < pair.value.count; j++) {
          const value = pair.value.get(j);
          // The parser should coerce matrix values to strings, ignore expressions
          if (isString(value)) {
            values.add(value.value);
          }
        }

        properties.set(key, values);
        break;
    }
  }

  if (include) {
    for (let i = 0; i < include.count; i++) {
      const item = include.get(i);
      if (!isMapping(item)) {
        continue;
      }

      for (let j = 0; j < item.count; j++) {
        const pair = item.get(j);
        addValueToProperties(properties, pair);
      }
    }
  }

  return properties;
}

function addValueToProperties(properties: Map<string, Set<string> | undefined>, pair: KeyValuePair): void {
  if (!isString(pair.key)) {
    return;
  }

  const key = pair.key.value;
  const value = isString(pair.value) ? pair.value.value : undefined;
  if (!properties.has(key)) {
    if (value === undefined) {
      properties.set(key, undefined);
      return;
    }

    properties.set(key, new Set<string>([value]));
    return;
  }

  if (value === undefined) {
    return;
  }

  const property = properties.get(key);
  if (property !== undefined) {
    property.add(value);
    return;
  }

  properties.set(key, new Set<string>([value]));
}
