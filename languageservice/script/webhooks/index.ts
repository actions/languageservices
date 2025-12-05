import {promises as fs} from "fs";
import Webhook from "./webhook.js";

import schemaImport from "rest-api-description/descriptions/api.github.com/dereferenced/api.github.com.deref.json";
import {deduplicateWebhooks} from "./deduplicate.js";
const schema = schemaImport as any;

const OUTPUT_PATH = "./src/context-providers/events/webhooks.json";
const OBJECTS_PATH = "./src/context-providers/events/objects.json";
const ALL_OUTPUT_PATH = "./src/context-providers/events/webhooks.all.json";
const ALL_OBJECTS_PATH = "./src/context-providers/events/objects.all.json";
const DROP_OUTPUT_PATH = "./src/context-providers/events/webhooks.drop.json";
const DROP_OBJECTS_PATH = "./src/context-providers/events/objects.drop.json";
const STRIP_OUTPUT_PATH = "./src/context-providers/events/webhooks.strip.json";
const STRIP_OBJECTS_PATH = "./src/context-providers/events/objects.strip.json";

// Parse --all flag
const generateAll = process.argv.includes("--all");

// Events to drop - not valid workflow triggers (GitHub App or API-only events)
// See: https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows
const DROPPED_EVENTS = new Set([
  "branch_protection_configuration",
  "code_scanning_alert",
  "commit_comment",
  "custom_property",
  "custom_property_values",
  "dependabot_alert",
  "deploy_key",
  "github_app_authorization",
  "installation",
  "installation_repositories",
  "installation_target",
  "marketplace_purchase",
  "member",
  "membership",
  "merge_group",
  "meta",
  "org_block",
  "organization",
  "package",
  "personal_access_token_request",
  "ping",
  "repository",
  "repository_advisory",
  "repository_ruleset",
  "secret_scanning_alert",
  "secret_scanning_alert_location",
  "security_advisory",
  "security_and_analysis",
  "sponsorship",
  "star",
  "team",
  "team_add"
]);

// Events to keep - valid workflow triggers
// See: https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows
const KEPT_EVENTS = new Set([
  "branch_protection_rule",
  "check_run",
  "check_suite",
  "create",
  "delete",
  "deployment",
  "deployment_status",
  "discussion",
  "discussion_comment",
  "fork",
  "gollum",
  "issue_comment",
  "issues",
  "label",
  "milestone",
  "page_build",
  "project",
  "project_card",
  "project_column",
  "projects_v2",
  "projects_v2_item",
  "public",
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "pull_request_review_thread",
  "push",
  "registry_package",
  "release",
  "repository_dispatch",
  "repository_import",
  "repository_vulnerability_alert",
  "status",
  "watch",
  "workflow_dispatch",
  "workflow_job",
  "workflow_run"
]);

/**
 * Fields to strip from the JSON data.
 *
 * EVENT_ACTION_FIELDS: stripped from each event action object (top level only)
 * Example event action object before stripping:
 *   {
 *     "description": "This event is triggered when...",  // <-- stripped
 *     "summary": "A brief summary",                      // <-- stripped
 *     "availability": ["repository"],                    // <-- stripped
 *     "category": "issues",                              // <-- stripped
 *     "action": "opened",                                // kept
 *     "bodyParameters": [...]                            // kept
 *   }
 *
 * BODY_PARAM_FIELDS: stripped from every bodyParameters object, recursively through childParamsGroups
 * Example bodyParameter object before stripping:
 *   {
 *     "type": "object",                                  // <-- stripped
 *     "name": "changes",                                 // kept (used for property names)
 *     "in": "body",                                      // <-- stripped
 *     "description": "The changes that were made.",      // kept (used for hover docs)
 *     "isRequired": true,                                // <-- stripped
 *     "enum": ["a", "b"],                                // <-- stripped
 *     "default": "a",                                    // <-- stripped
 *     "childParamsGroups": [                             // kept (used for nested properties)
 *       {
 *         "type": "string",                              // <-- stripped (recursive)
 *         "name": "from",                                // kept
 *         "isRequired": true                             // <-- stripped (recursive)
 *       }
 *     ]
 *   }
 */
const EVENT_ACTION_FIELDS = ["description", "summary", "availability", "category"];
const BODY_PARAM_FIELDS = ["type", "in", "isRequired", "enum", "default"];

/**
 * Strip fields from a bodyParameter object and recursively from childParamsGroups.
 */
function stripBodyParam(param: any): any {
  if (typeof param !== "object" || param === null) {
    return param;
  }

  const result: any = {};
  for (const [key, value] of Object.entries(param)) {
    if (BODY_PARAM_FIELDS.includes(key)) {
      continue; // Strip this field
    }
    if (key === "childParamsGroups" && Array.isArray(value)) {
      result[key] = value.map(stripBodyParam);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Strip unused fields from event action data.
 */
function stripEventActionFields(action: any): any {
  const result: any = {};
  for (const [key, value] of Object.entries(action)) {
    if (EVENT_ACTION_FIELDS.includes(key)) {
      continue; // Strip this field
    }
    if (key === "bodyParameters" && Array.isArray(value)) {
      result[key] = value.map((p: any) => (typeof p === "number" ? p : stripBodyParam(p)));
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Strip unused fields from all webhooks.
 * Structure: { eventName: { actionName: { ...fields } } }
 */
function stripFields(webhooks: Record<string, Record<string, any>>): Record<string, Record<string, any>> {
  const result: Record<string, Record<string, any>> = {};
  for (const [eventName, actions] of Object.entries(webhooks)) {
    result[eventName] = {};
    for (const [actionName, actionData] of Object.entries(actions)) {
      result[eventName][actionName] = stripEventActionFields(actionData);
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
  console.error("  2. Add the event to DROPPED_EVENTS or KEPT_EVENTS in:");
  console.error("     languageservice/script/webhooks/index.ts");
  console.error("");
  console.error("  3. See docs/json-data-files.md for more details.");
  console.error("");
  process.exit(1);
}

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

// Strip fields before deduplication
const strippedWebhooks = stripFields(categorizedWebhooks);

// Deduplicate after dropping and stripping
const objectsArray = deduplicateWebhooks(strippedWebhooks);

// Write optimized output
await fs.writeFile(OBJECTS_PATH, JSON.stringify(objectsArray, null, 2));
await fs.writeFile(OUTPUT_PATH, JSON.stringify(strippedWebhooks, null, 2));

console.log(`Wrote ${OUTPUT_PATH} (${Object.keys(strippedWebhooks).length} events)`);
console.log(`Wrote ${OBJECTS_PATH} (${objectsArray.length} objects)`);

// Optionally generate intermediate versions for size comparison
if (generateAll) {
  // Helper to deep clone
  function clone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  // Build full webhooks (no drop, no strip) from fresh data
  const fullWebhooks: Record<string, Record<string, any>> = {};
  for (const webhook of webhooks) {
    const w = clone(webhook);
    if (!w.action) w.action = "default";
    fullWebhooks[w.category] ||= {};
    fullWebhooks[w.category][w.action] = w;
  }

  // Generate all version (no drop, no strip)
  const allWebhooks = clone(fullWebhooks);
  const allObjects = deduplicateWebhooks(allWebhooks);
  await fs.writeFile(ALL_OUTPUT_PATH, JSON.stringify(allWebhooks, null, 2));
  await fs.writeFile(ALL_OBJECTS_PATH, JSON.stringify(allObjects, null, 2));
  console.log(`Wrote ${ALL_OUTPUT_PATH} (${Object.keys(allWebhooks).length} events)`);
  console.log(`Wrote ${ALL_OBJECTS_PATH} (${allObjects.length} objects)`);

  // Generate drop-only version (drop events, no strip)
  const dropWebhooks = clone(fullWebhooks);
  for (const event of DROPPED_EVENTS) {
    delete dropWebhooks[event];
  }
  const dropObjects = deduplicateWebhooks(dropWebhooks);
  await fs.writeFile(DROP_OUTPUT_PATH, JSON.stringify(dropWebhooks, null, 2));
  await fs.writeFile(DROP_OBJECTS_PATH, JSON.stringify(dropObjects, null, 2));
  console.log(`Wrote ${DROP_OUTPUT_PATH} (${Object.keys(dropWebhooks).length} events)`);
  console.log(`Wrote ${DROP_OBJECTS_PATH} (${dropObjects.length} objects)`);

  // Generate strip-only version (strip fields, no drop)
  const stripWebhooks = stripFields(clone(fullWebhooks));
  const stripObjects = deduplicateWebhooks(stripWebhooks);
  await fs.writeFile(STRIP_OUTPUT_PATH, JSON.stringify(stripWebhooks, null, 2));
  await fs.writeFile(STRIP_OBJECTS_PATH, JSON.stringify(stripObjects, null, 2));
  console.log(`Wrote ${STRIP_OUTPUT_PATH} (${Object.keys(stripWebhooks).length} events)`);
  console.log(`Wrote ${STRIP_OBJECTS_PATH} (${stripObjects.length} objects)`);
}
