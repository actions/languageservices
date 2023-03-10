import {promises as fs} from "fs";
import Webhook from "./webhook.js";

import schemaImport from "rest-api-description/descriptions/api.github.com/dereferenced/api.github.com.deref.json" assert {type: "json"};
import {deduplicateWebhooks} from "./deduplicate.js";
const schema = schemaImport as any;

const OUTPUT_PATH = "./src/context-providers/events/webhooks.json";
const OBJECTS_PATH = "./src/context-providers/events/objects.json";

const rawWebhooks = Object.values(schema.webhooks || schema["x-webhooks"]) as any[];
if (!rawWebhooks) {
  throw new Error("No webhooks found in schema");
}

const webhooks: Webhook[] = [];
for (const webhook of Object.values(rawWebhooks)) {
  webhooks.push(new Webhook(webhook.post));
}

await Promise.all(webhooks.map(webhook => webhook.process()));

// The category is the name of the webhook
const categorizedWebhooks: Record<string, Record<string, Webhook>> = {};
for (const webhook of webhooks) {
  if (!webhook.action) webhook.action = "default";

  if (categorizedWebhooks[webhook.category]) {
    categorizedWebhooks[webhook.category][webhook.action] = webhook;
  } else {
    categorizedWebhooks[webhook.category] = {};
    categorizedWebhooks[webhook.category][webhook.action] = webhook;
  }
}

const objectsArray = deduplicateWebhooks(categorizedWebhooks);

await fs.writeFile(OBJECTS_PATH, JSON.stringify(objectsArray, null, 2));
await fs.writeFile(OUTPUT_PATH, JSON.stringify(categorizedWebhooks, null, 2));
