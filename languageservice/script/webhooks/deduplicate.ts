import Webhook from "./webhook";

/**
 * Get the name from a param.
 * Formats: "name" (string), or [name, ...] (array)
 */
function getParamName(param: any): string {
  if (typeof param === "string") {
    return param;
  }
  if (Array.isArray(param)) {
    return param[0];
  }
  return param.name;
}

/**
 * Get params from a webhook action.
 * Uses 'p' (short key) if present, falls back to 'bodyParameters'
 */
function getParams(webhook: any): any[] {
  return webhook.p || webhook.bodyParameters || [];
}

/**
 * Set params on a webhook action using the short key 'p'
 */
function setParams(webhook: any, params: any[]): void {
  if (webhook.p !== undefined) {
    webhook.p = params;
  } else {
    webhook.bodyParameters = params;
  }
}

// Store any repeated body parameters in an array
// and replace them in the webhook with an index in the array
export function deduplicateWebhooks(webhooks: Record<string, Record<string, Webhook>>): any[] {
  /**
   * Build a map of all objects by name
   */
  const objectsByName: Record<string, any[]> = {};
  const objectCount: Record<string, number> = {};

  for (const webhook of iterateWebhooks(webhooks)) {
    for (const param of getParams(webhook)) {
      const name = getParamName(param);
      objectsByName[name] ||= [];
      const index = findOrAdd(param, objectsByName[name]);
      const key = `${name}:${index}`;
      objectCount[key] ||= 0;
      objectCount[key]++;
    }
  }

  /**
   * Replace any duplicated body parameters with an index
   */
  const duplicatedBodyParams: any[] = [];
  const bodyParamIndexMap: Record<string, number> = {};

  for (const webhook of iterateWebhooks(webhooks)) {
    const newParams: any[] = [];
    for (const param of getParams(webhook)) {
      const name = getParamName(param);
      const index = find(param, objectsByName[name]);
      const key = `${name}:${index}`;
      if (objectCount[key] > 1) {
        newParams.push(indexForParam(param, name, index, bodyParamIndexMap, duplicatedBodyParams));
      } else {
        // If an object is only used once, keep it inline
        newParams.push(param);
      }
    }

    setParams(webhook, newParams);
  }

  return duplicatedBodyParams;
}

function* iterateWebhooks(webhooks: Record<string, Record<string, Webhook>>) {
  for (const webhookActions of Object.values(webhooks)) {
    for (const webhook of Object.values(webhookActions)) {
      yield webhook;
    }
  }
}

function findOrAdd(param: any, objects: any[]): number {
  for (const [index, object] of objects.entries()) {
    if (JSON.stringify(object) === JSON.stringify(param)) {
      return index;
    }
  }

  return objects.push(param) - 1;
}

function find(param: any, objects: any[]): number {
  for (const [index, object] of objects.entries()) {
    if (JSON.stringify(object) === JSON.stringify(param)) {
      return index;
    }
  }

  throw new Error(`Could not find object ${param.name}`);
}

function indexForParam(
  param: any,
  paramName: string,
  paramNameIndex: number,
  objectIndexMap: Record<string, number>,
  duplicatedBodyParams: any[]
): number {
  const key = `${paramName}:${paramNameIndex}`;

  const existingIndex = objectIndexMap[key];
  if (existingIndex !== undefined) {
    // Object has already been added to the array
    return existingIndex;
  }

  // Add the object to the array
  const objIdx = duplicatedBodyParams.push(param) - 1;
  objectIndexMap[key] = objIdx;
  return objIdx;
}
