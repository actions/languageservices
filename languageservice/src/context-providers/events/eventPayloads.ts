import {data, DescriptionDictionary} from "@github/actions-expressions";

import webhooks from "./webhooks.json";
import webhookObjects from "./objects.json";

import schedule from "./schedule.json" assert {type: "json"};
import workflow_call from "./workflow_call.json" assert {type: "json"};

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
 * A full {@link Param} or an index into the objects array for deduplicated parameters
 */
type DeduplicatedParam = Param | number;

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

type DeduplicatedWebhooks = {
  [name: string]: {
    [action: string]: WebhookPayload & {
      bodyParameters: DeduplicatedParam[];
    };
  };
};

const dedupedWebhookPayloads: DeduplicatedWebhooks = webhooks as any;
const objects: Param[] = webhookObjects as any;

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

export function getEventPayload(event: string, action: string = "default"): DescriptionDictionary | undefined {
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
    if (!!target.get(param.name)) {
      return;
    }

    target.add(param.name, new data.Null(), param.description);
  }
}

function mergeObject(d: DescriptionDictionary, toAdd: Object): DescriptionDictionary {
  for (const [key, value] of Object.entries(toAdd)) {
    if (value && typeof value === "object" && !d.get(key)) {
      if (!Array.isArray(value) && Object.entries(value).length === 0) {
        // Allow an empty object to be any value
        d.add(key, new data.Null());
        continue;
      }

      d.add(key, mergeObject(new DescriptionDictionary(), value));
    } else {
      d.add(key, new data.Null());
    }
  }

  return d;
}

function getWebhookPayload(event: string, action: string): WebhookPayload | undefined {
  const deduplicatedPayload = dedupedWebhookPayloads?.[event]?.[action];
  if (!deduplicatedPayload) {
    return undefined;
  }

  const existingPayload = webhookPayloads?.[event]?.[action];
  if (existingPayload) {
    return existingPayload;
  }

  // Recreate the full payload and store it for reuse
  const params = deduplicatedPayload.bodyParameters.map(p => fullParam(p));
  const payload = {
    ...deduplicatedPayload,
    bodyParameters: params
  };
  webhookPayloads[event] ||= {};
  webhookPayloads[event][action] = payload;
  return payload;
}

function fullParam(dedupedParam: DeduplicatedParam): Param {
  if (typeof dedupedParam === "number") {
    if (dedupedParam >= objects.length) {
      throw new Error(`Unknown object ${dedupedParam}`);
    }
    return objects[dedupedParam];
  }

  return dedupedParam;
}
