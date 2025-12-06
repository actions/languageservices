import {promises as fs} from "fs";
import Webhook from "./webhook.js";

import schemaImport from "rest-api-description/descriptions/api.github.com/dereferenced/api.github.com.deref.json";
import {deduplicateWebhooks} from "./deduplicate.js";
import eventFilters from "../../src/context-providers/events/event-filters.json";
const schema = schemaImport as any;

const DROPPED_EVENTS = new Set(eventFilters.dropped);
const KEPT_EVENTS = new Set(eventFilters.kept);

const OUTPUT_PATH = "./src/context-providers/events/webhooks.json";
const OBJECTS_PATH = "./src/context-providers/events/webhooks.objects.json";
const STRINGS_PATH = "./src/context-providers/events/webhooks.strings.json";
const FULL_OUTPUT_PATH = "./src/context-providers/events/webhooks.full.json";

/**
 * Fields discarded from each event action object (top level only).
 * Body parameters are compacted to only keep name, description, and childParamsGroups.
 */
const EVENT_ACTION_FIELDS = ["description", "summary", "availability", "category", "action"];

/**
 * Convert a bodyParameter object to compact array format.
 *
 * Format (type-based dispatch):
 *   - "name"                      - name only (just a string)
 *   - [name, desc]                - name + description (desc is string)
 *   - [name, [...children]]       - name + children (arr[1] is array)
 *   - [name, desc, [...children]] - name + description + children
 *
 * The reader uses typeof to determine the meaning:
 *   - string -> name only
 *   - array with string arr[1] -> name + description
 *   - array with array arr[1] -> name + children
 */
function compactParam(param: any): any {
  if (typeof param !== "object" || param === null) {
    return param;
  }

  const name: string = param.name;
  const desc: string | undefined = param.description;
  const children: any[] | undefined = param.childParamsGroups;

  const hasDesc = desc && desc.length > 0;
  const hasChildren = children && children.length > 0;

  if (hasDesc && hasChildren) {
    return [name, desc, children.map(compactParam)];
  } else if (hasChildren) {
    return [name, children.map(compactParam)];
  } else if (hasDesc) {
    return [name, desc];
  } else {
    return name; // Just the string, not wrapped in array
  }
}

/**
 * Convert event action data to compact format.
 */
function compactEventAction(action: any): any {
  const result: any = {};
  for (const [key, value] of Object.entries(action)) {
    if (EVENT_ACTION_FIELDS.includes(key)) {
      continue; // Discard this field
    }
    if (key === "bodyParameters" && Array.isArray(value)) {
      // Use short key 'p' for params
      result["p"] = value.map((p: any) => (typeof p === "number" ? p : compactParam(p)));
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Convert all webhooks to compact format.
 * Structure: { eventName: { actionName: { ...fields } } }
 */
function compactWebhooks(webhooks: Record<string, Record<string, any>>): Record<string, Record<string, any>> {
  const result: Record<string, Record<string, any>> = {};
  for (const [eventName, actions] of Object.entries(webhooks)) {
    result[eventName] = {};
    for (const [actionName, actionData] of Object.entries(actions)) {
      result[eventName][actionName] = compactEventAction(actionData);
    }
  }
  return result;
}

const rawWebhooks = Object.values(schema.webhooks || schema["x-webhooks"]) as any[];
if (!rawWebhooks) {
  throw new Error("No webhooks found in schema");
}

const webhooks: Webhook[] = [];
for (const webhook of Object.values(rawWebhooks)) {
  webhooks.push(new Webhook(webhook.post));
}

await Promise.all(webhooks.map(webhook => webhook.process()));

// Check for unknown events (not in DROPPED_EVENTS or KEPT_EVENTS)
const unknownEvents: string[] = [];
for (const webhook of webhooks) {
  if (!DROPPED_EVENTS.has(webhook.category) && !KEPT_EVENTS.has(webhook.category)) {
    if (!unknownEvents.includes(webhook.category)) {
      unknownEvents.push(webhook.category);
    }
  }
}

if (unknownEvents.length > 0) {
  console.error("");
  console.error("══════════════════════════════════════════════════════════════════");
  console.error("ERROR: New webhook event(s) detected!");
  console.error("══════════════════════════════════════════════════════════════════");
  console.error("");
  console.error("The following events are not categorized:");
  for (const event of unknownEvents.sort()) {
    console.error(`  - ${event}`);
  }
  console.error("");
  console.error("Action required:");
  console.error("  1. Check if the event is a valid workflow trigger:");
  console.error(
    "     https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows"
  );
  console.error("");
  console.error("  2. Add the event to 'dropped' or 'kept' array in:");
  console.error("     languageservice/src/context-providers/events/event-filters.json");
  console.error("");
  console.error("  3. See docs/json-data-files.md for more details.");
  console.error("");
  process.exit(1);
}

// Build full webhooks (all events, no transformations) for validation tests
const fullWebhooks: Record<string, Record<string, Webhook>> = {};
for (const webhook of webhooks) {
  if (!webhook.action) webhook.action = "default";

  if (fullWebhooks[webhook.category]) {
    fullWebhooks[webhook.category][webhook.action] = webhook;
  } else {
    fullWebhooks[webhook.category] = {};
    fullWebhooks[webhook.category][webhook.action] = webhook;
  }
}

// Write full version (before any optimizations)
await fs.writeFile(FULL_OUTPUT_PATH, JSON.stringify(fullWebhooks, null, 2));
console.log(`Wrote ${FULL_OUTPUT_PATH} (${Object.keys(fullWebhooks).length} events, unoptimized)`);

// The category is the name of the webhook
const categorizedWebhooks: Record<string, Record<string, Webhook>> = {};
for (const webhook of webhooks) {
  if (!webhook.action) webhook.action = "default";

  // Drop unused events
  if (DROPPED_EVENTS.has(webhook.category)) {
    continue;
  }

  if (categorizedWebhooks[webhook.category]) {
    categorizedWebhooks[webhook.category][webhook.action] = webhook;
  } else {
    categorizedWebhooks[webhook.category] = {};
    categorizedWebhooks[webhook.category][webhook.action] = webhook;
  }
}

// Convert to compact format before deduplication
const compactedWebhooks = compactWebhooks(categorizedWebhooks);

// Deduplicate after compacting
const objectsArray = deduplicateWebhooks(compactedWebhooks);

// ============================================================================
// String Interning (Phase 3)
// ============================================================================
// Intern duplicate property names to reduce file size.
// Names appearing 2+ times are stored in a string table and referenced by index.
// Singleton names stay as literal strings for readability.

/**
 * Collect all property names from params (for frequency counting)
 */
function collectNames(param: any, counts: Map<string, number>): void {
  if (typeof param === "number") return;
  if (typeof param === "string") {
    counts.set(param, (counts.get(param) || 0) + 1);
    return;
  }
  if (Array.isArray(param)) {
    const name = param[0] as string;
    counts.set(name, (counts.get(name) || 0) + 1);
    const children = Array.isArray(param[1]) ? param[1] : param[2];
    if (children) children.forEach((c: any) => collectNames(c, counts));
  }
}

/**
 * Replace duplicate names with indices into the string table.
 * Object references use negative indices: objectIndex -> -(objectIndex + 1)
 * String references use non-negative indices: stringIndex -> stringIndex
 *
 * @param param - The param to process
 * @param nameToIndex - Map from name to string table index
 */
function internNames(param: any, nameToIndex: Map<string, number>): any {
  // Object reference (already a number from deduplication) -> make negative
  if (typeof param === "number") return -(param + 1);

  // String -> intern if in table, otherwise keep as literal
  if (typeof param === "string") {
    const idx = nameToIndex.get(param);
    return idx !== undefined ? idx : param;
  }

  if (Array.isArray(param)) {
    const name = param[0] as string;
    const idx = nameToIndex.get(name);
    const internedName = idx !== undefined ? idx : name;

    // Handle different array formats
    if (typeof param[1] === "string" && !Array.isArray(param[1])) {
      // [name, desc] or [name, desc, children]
      if (param.length === 2) {
        return [internedName, param[1]];
      } else {
        return [internedName, param[1], (param[2] as any[]).map((c: any) => internNames(c, nameToIndex))];
      }
    } else if (Array.isArray(param[1])) {
      // [name, children]
      return [internedName, param[1].map((c: any) => internNames(c, nameToIndex))];
    }
    // Shouldn't happen, but fallback
    return [internedName, ...param.slice(1)];
  }
  return param;
}

// Pass 1: Count all names
const nameCounts = new Map<string, number>();
objectsArray.forEach((obj: any) => collectNames(obj, nameCounts));
for (const event of Object.values(compactedWebhooks)) {
  for (const action of Object.values(event as Record<string, any>)) {
    if (action.p) action.p.forEach((p: any) => collectNames(p, nameCounts));
  }
}

// Build string table from duplicates, sorted by frequency (most common first = smaller indices)
const sortedNames = [...nameCounts.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]);
const stringTable = sortedNames.map(([name]) => name);
const nameToIndex = new Map(stringTable.map((name, i) => [name, i]));

console.log(
  `String table: ${stringTable.length} interned names (${nameCounts.size - stringTable.length} singletons kept inline)`
);

// Pass 2: Intern names in objects and webhooks
// Objects use negative indices, strings use non-negative indices
const internedObjects = objectsArray.map((obj: any) => internNames(obj, nameToIndex));
const internedWebhooks: Record<string, Record<string, any>> = {};
for (const [eventName, actions] of Object.entries(compactedWebhooks)) {
  internedWebhooks[eventName] = {};
  for (const [actionName, actionData] of Object.entries(actions as Record<string, any>)) {
    internedWebhooks[eventName][actionName] = {
      p: actionData.p.map((p: any) => internNames(p, nameToIndex))
    };
  }
}

// Write optimized output with separate string table
// Format: webhooks.strings.json has string table, webhooks.json/webhooks.objects.json reference by index
const finalOutput = {
  "//": "Generated file - refer to docs/json-data-files.md for format documentation",
  ...internedWebhooks
};

await fs.writeFile(STRINGS_PATH, JSON.stringify(stringTable, null, 2));
await fs.writeFile(OBJECTS_PATH, JSON.stringify(internedObjects, null, 2));
await fs.writeFile(OUTPUT_PATH, JSON.stringify(finalOutput, null, 2));

console.log(`Wrote ${STRINGS_PATH} (${stringTable.length} interned strings)`);
console.log(`Wrote ${OUTPUT_PATH} (${Object.keys(compactedWebhooks).length} events)`);
console.log(`Wrote ${OBJECTS_PATH} (${internedObjects.length} objects)`);
