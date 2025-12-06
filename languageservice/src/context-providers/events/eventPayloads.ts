import {data, DescriptionDictionary} from "@actions/expressions";

import webhooksData from "./webhooks.min.json";
import objectsData from "./webhooks.objects.min.json";
import stringsData from "./webhooks.strings.min.json";

import schedule from "./schedule.min.json";
import workflow_call from "./workflow_call.min.json";

const customEventPayloads: {[name: string]: unknown} = {
  schedule,
  workflow_call
};

type ParamType =
  | "array of objects or null"
  | "array of objects"
  | "array of strings or null"
  | "array of strings"
  | "array"
  | "boolean or null"
  | "boolean or string or integer or object"
  | "boolean"
  | "integer or null"
  | "integer or string or null"
  | "integer or string"
  | "integer"
  | "null"
  | "number"
  | "object or null"
  | "object or object or object or object"
  | "object or object"
  | "object or string"
  | "object"
  | "string or null"
  | "string or number"
  | "string or object or integer or null"
  | "string or object or null"
  | "string or object"
  | "string";

type Param = {
  type: ParamType;
  name: string;
  in: "body";
  isRequired: boolean;
  description: string;
  childParamsGroups?: Param[];
  enum?: string[];
};

/**
 * Compact format for params (written by update-webhooks.ts).
 *
 * Names can be interned (number = index into string table) or literal strings.
 * Type-based dispatch:
 *   - number                   - interned name only (index into string table)
 *   - "name"                   - literal name only (singleton, not interned)
 *   - [name, desc]             - name + description (name is number or string, desc is string)
 *   - [name, [...children]]    - name + children (arr[1] is array)
 *   - [name, desc, [...children]] - name + description + children
 */
type InternedName = number | string;
type CompactParam =
  | InternedName
  | [InternedName, string]
  | [InternedName, CompactParam[]]
  | [InternedName, string, CompactParam[]];

type WebhookPayload = {
  descriptionHtml: string;
  summaryHtml: string;
  bodyParameters: Param[];
};

type Webhooks = {
  [name: string]: {
    [action: string]: WebhookPayload;
  };
};

/**
 * Webhooks data format after optimization:
 * {
 *   [event]: { [action]: { p: CompactParam[] } }
 * }
 *
 * String table and objects are loaded from separate files.
 */
type WebhooksData = {
  [key: string]: {[action: string]: {p: CompactParam[]}};
};

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
const webhooksJson: WebhooksData = webhooksData as any;
const objectsJson: CompactParam[] = objectsData as any;

// String table and objects are in separate files
const stringTable: string[] = stringsData;
const objects: CompactParam[] = objectsJson;

// Build event payloads map (skip "//" comment key)
const dedupedWebhookPayloads: {[event: string]: {[action: string]: {p: CompactParam[]}}} = {};
for (const [key, value] of Object.entries(webhooksJson)) {
  if (key !== "//" && typeof value === "object" && value !== null) {
    dedupedWebhookPayloads[key] = value as {[action: string]: {p: CompactParam[]}};
  }
}
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */

// Hydrated webhook payloads
const webhookPayloads: Webhooks = {};

// Hydrate the workflow dispatch payload if it exists
getWebhookPayload("workflow_dispatch", "default");

//
// Manual work-arounds for webhook issues
//
const inputs = webhookPayloads?.["workflow_dispatch"]?.["default"].bodyParameters.find(p => p.name === "inputs");
if (inputs) {
  delete inputs.childParamsGroups;
}

export function getSupportedEventTypes(event: string): string[] {
  const payloads = dedupedWebhookPayloads?.[event];
  if (!payloads) {
    if (customEventPayloads[event]) {
      return ["default"];
    }
  }

  return Object.keys(payloads || {});
}

export function getEventPayload(event: string, action: string): DescriptionDictionary | undefined {
  const payload = getWebhookPayload(event, action);
  if (!payload) {
    // Not all events are real webhooks. Check if there is a custom payload for this event
    const customPayload = customEventPayloads[event];
    if (customPayload) {
      return mergeObject(new DescriptionDictionary(), customPayload);
    }

    return undefined;
  }

  const d = new DescriptionDictionary();
  payload.bodyParameters.forEach(p => mergeParam(d, p));
  return d;
}

function mergeParam(target: DescriptionDictionary, param: Param) {
  if (param.childParamsGroups?.length || 0 > 0) {
    // If there are any child params, add this param as an object
    const d = new DescriptionDictionary();
    param.childParamsGroups?.forEach(p => mergeParam(d, p));
    target.add(param.name, d, param.description);
  } else {
    // Otherwise add as a null value. We do not care about the actual content for validation
    // auto-completion. Possible existence and the description are enough.
    //
    // As a special case, if the param is already set, do not overwrite it.
    if (target.get(param.name)) {
      return;
    }

    target.add(param.name, new data.Null(), param.description);
  }
}

function mergeObject(d: DescriptionDictionary, toAdd: object): DescriptionDictionary {
  for (const [key, value] of Object.entries(toAdd)) {
    if (value && typeof value === "object" && !d.get(key)) {
      if (!Array.isArray(value) && Object.entries(value as object).length === 0) {
        // Allow an empty object to be any value
        d.add(key, new data.Null());
        continue;
      }

      d.add(key, mergeObject(new DescriptionDictionary(), value as object));
    } else {
      d.add(key, new data.Null());
    }
  }

  return d;
}

function getWebhookPayload(event: string, action: string): WebhookPayload | undefined {
  // Is the payload already hydrated?
  const existingPayload = webhookPayloads?.[event]?.[action];
  if (existingPayload) {
    return existingPayload;
  }

  const deduplicatedPayload = dedupedWebhookPayloads?.[event]?.[action];
  if (!deduplicatedPayload) {
    return undefined;
  }

  // Get params from 'p' (compact format)
  const dedupedParams = deduplicatedPayload.p || [];

  // Recreate the full payload and store it for reuse
  const params = dedupedParams.map(p => fullParam(p));
  const payload = {
    descriptionHtml: "",
    summaryHtml: "",
    bodyParameters: params
  };
  webhookPayloads[event] ||= {};
  webhookPayloads[event][action] = payload;
  return payload;
}

/**
 * Resolve an interned name (non-negative number -> string table lookup) or return literal string
 */
function resolveName(name: InternedName): string {
  if (typeof name === "number") {
    if (name < 0 || name >= stringTable.length) {
      throw new Error(`Unknown interned name index ${name}`);
    }
    return stringTable[name];
  }
  return name;
}

/**
 * Convert a deduplicated param to a full Param.
 *
 * Compact format (type-based dispatch):
 *   - negative number          - object index: -(n + 1) -> objects[-n - 1]
 *   - non-negative number      - interned string index -> stringTable[n]
 *   - "name"                   - literal name only (singleton, not interned)
 *   - [name, desc]             - name + description (name can be number or string)
 *   - [name, [...children]]    - name + children (arr[1] is array)
 *   - [name, desc, [...children]] - name + description + children
 */
function fullParam(dedupedParam: CompactParam): Param {
  // Negative number -> object index
  if (typeof dedupedParam === "number" && dedupedParam < 0) {
    const objectIndex = -(dedupedParam + 1);
    if (objectIndex >= objects.length) {
      throw new Error(`Unknown object index ${objectIndex} (from ${dedupedParam})`);
    }
    return fullParam(objects[objectIndex]);
  }

  // Non-negative number or literal string -> name only
  if (typeof dedupedParam === "number" || typeof dedupedParam === "string") {
    return {
      name: resolveName(dedupedParam),
      description: ""
    } as Param;
  }

  // Compact array format -> convert to Param object
  if (Array.isArray(dedupedParam)) {
    const arr = dedupedParam;
    const name = resolveName(arr[0]);

    // Type-based dispatch: if arr[1] is string -> description, if array -> children
    const description = typeof arr[1] === "string" ? arr[1] : "";
    // arr[1] is children if it's an array, otherwise arr[2] is children (if it exists and is an array)
    const childrenArr = Array.isArray(arr[1]) ? arr[1] : Array.isArray(arr[2]) ? arr[2] : undefined;
    const childParamsGroups = childrenArr ? childrenArr.map(c => fullParam(c)) : undefined;

    return {
      name,
      description,
      childParamsGroups
    } as Param;
  }

  throw new Error(`Unexpected param format: ${JSON.stringify(dedupedParam)}`);
}
