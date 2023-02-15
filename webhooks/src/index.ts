import fetch from "node-fetch";
import {promises as fs} from "fs";
import Webhook from "./webhook.js";

const SCHEMA_URL =
  "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/dereferenced/api.github.com.deref.json";
const OUTPUT_PATH = "src/webhooks.json";

const schema: any = await fetch(SCHEMA_URL).then(res => res.json());

const rawWebhooks = Object.values(schema.webhooks || schema["x-webhooks"]) as any[];
if (!rawWebhooks) {
  throw new Error("No webhooks found in schema");
}

const webhooks = [];
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

await fs.writeFile(OUTPUT_PATH, JSON.stringify(categorizedWebhooks, null, 2));
