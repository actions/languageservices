import * as fs from "fs";

/**
 * This test ensures that activity types in workflow-v1.0.json stay in sync with
 * the webhooks.json file from the languageservice package.
 *
 * When this test fails, it means new activity types were added to webhooks.json
 * that need to be handled. See docs/json-data-files.md for detailed instructions.
 *
 * Quick reference for fixing failures:
 * 1. Check https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows
 *    Find the event and look at its "Activity types" table to see if the type is a valid workflow trigger.
 * 2. If the activity type IS a valid workflow trigger:
 *    → Add it to the corresponding *-activity-type definition in workflow-v1.0.json
 * 3. If the activity type is webhook-only (not in workflow docs):
 *    → Add it to the WEBHOOK_ONLY list below
 * 4. If there's a naming difference between webhook and schema:
 *    → Add it to the NAME_MAPPINGS list below
 * 5. If the schema has a type not in webhooks.json:
 *    → Add it to the SCHEMA_ONLY list below
 */

describe("schema-sync", () => {
  // Activity types that exist in webhooks.json but are intentionally NOT
  // supported as workflow triggers. These will be ignored when checking
  // webhooks → schema direction.
  const WEBHOOK_ONLY: Record<string, string[]> = {
    // check_suite: requested and rerequested are webhook-only, not valid workflow triggers
    // See: https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#check_suite
    check_suite: ["requested", "rerequested"],

    // registry_package: "default" is a webhook concept, not a workflow trigger type
    registry_package: ["default"]
  };

  // Activity types that exist in workflow schema but are intentionally NOT
  // in webhooks.json (schema-only types). These will be ignored when checking
  // schema → webhooks direction.
  const SCHEMA_ONLY: Record<string, string[]> = {
    // registry_package: "updated" is a valid workflow trigger per GitHub docs
    // but doesn't exist in webhooks.json (webhooks only has "published" and "default")
    // See: https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#registry_package
    registry_package: ["updated"]
  };

  // Known naming differences between webhooks.json and workflow-v1.0.json.
  // Key: event name, Value: { webhook: "webhookName", schema: "schemaName" }
  // These are treated as equivalent when comparing in both directions.
  const NAME_MAPPINGS: Record<string, Array<{webhook: string; schema: string}>> = {
    // project_column: webhooks.json uses "edited" but workflow triggers use "updated"
    // This is a known naming difference - they represent the same action
    project_column: [{webhook: "edited", schema: "updated"}]
  };

  it("activity types in workflow-v1.0.json match webhooks.json", () => {
    // Load webhooks.json (relative path from the test runner CWD which is the package root)
    const webhooksPath = "../languageservice/src/context-providers/events/webhooks.json";
    const webhooks = JSON.parse(fs.readFileSync(webhooksPath, "utf-8")) as Record<string, Record<string, unknown>>;

    // Load workflow-v1.0.json
    const schemaPath = "./src/workflow-v1.0.json";
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8")) as {
      definitions: Record<string, {"allowed-values"?: string[]; description?: string}>;
    };

    const mismatches: string[] = [];

    // Build mapping helpers for each event
    const getWebhookToSchemaMapping = (eventName: string): Map<string, string> => {
      const map = new Map<string, string>();
      for (const mapping of NAME_MAPPINGS[eventName] || []) {
        map.set(mapping.webhook, mapping.schema);
      }
      return map;
    };

    const getSchemaToWebhookMapping = (eventName: string): Map<string, string> => {
      const map = new Map<string, string>();
      for (const mapping of NAME_MAPPINGS[eventName] || []) {
        map.set(mapping.schema, mapping.webhook);
      }
      return map;
    };

    // Check both directions for each event
    for (const [eventName, eventData] of Object.entries(webhooks)) {
      const webhookTypes = Object.keys(eventData);
      if (webhookTypes.length === 0) continue;

      const schemaTypeName = `${eventName.replace(/_/g, "-")}-activity-type`;
      const schemaDef = schema.definitions[schemaTypeName];

      // If there's no activity type definition in the schema, this event
      // doesn't support activity types in workflows (e.g., push, pull)
      if (!schemaDef || !schemaDef["allowed-values"]) continue;

      const schemaTypes = new Set(schemaDef["allowed-values"]);
      const webhookOnly = new Set(WEBHOOK_ONLY[eventName] || []);
      const schemaOnly = new Set(SCHEMA_ONLY[eventName] || []);
      const webhookToSchema = getWebhookToSchemaMapping(eventName);
      const schemaToWebhook = getSchemaToWebhookMapping(eventName);

      // Direction 1: webhooks → schema
      // Check that each webhook type exists in schema (or has a mapping, or is webhook-only)
      for (const webhookType of webhookTypes) {
        if (webhookOnly.has(webhookType)) continue;

        const mappedSchemaType = webhookToSchema.get(webhookType);
        if (mappedSchemaType) {
          // Has a mapping - check the mapped name exists in schema
          if (!schemaTypes.has(mappedSchemaType)) {
            mismatches.push(
              `Event "${eventName}": webhook type "${webhookType}" maps to "${mappedSchemaType}" but "${mappedSchemaType}" not found in schema`
            );
          }
        } else {
          // No mapping - check the type exists directly
          if (!schemaTypes.has(webhookType)) {
            mismatches.push(
              `Event "${eventName}": missing activity type "${webhookType}" in workflow-v1.0.json (exists in webhooks.json)`
            );
          }
        }
      }

      // Direction 2: schema → webhooks
      // Check that each schema type exists in webhooks (or has a mapping, or is schema-only)
      const webhookTypesSet = new Set(webhookTypes);
      for (const schemaType of schemaTypes) {
        if (schemaOnly.has(schemaType)) continue;

        const mappedWebhookType = schemaToWebhook.get(schemaType);
        if (mappedWebhookType) {
          // Has a mapping - check the mapped name exists in webhooks
          if (!webhookTypesSet.has(mappedWebhookType)) {
            mismatches.push(
              `Event "${eventName}": schema type "${schemaType}" maps to "${mappedWebhookType}" but "${mappedWebhookType}" not found in webhooks.json`
            );
          }
        } else {
          // No mapping - check the type exists directly
          if (!webhookTypesSet.has(schemaType)) {
            mismatches.push(
              `Event "${eventName}": extra activity type "${schemaType}" in workflow-v1.0.json (not in webhooks.json)`
            );
          }
        }
      }

      // Check that the description mentions all allowed values
      const activityDefName = `${eventName.replace(/_/g, "-")}-activity`;
      const activityDef = schema.definitions[activityDefName];
      if (activityDef?.description) {
        for (const schemaType of schemaTypes) {
          if (!activityDef.description.includes(`\`${schemaType}\``)) {
            mismatches.push(
              `Event "${eventName}": description in "${activityDefName}" is missing activity type \`${schemaType}\``
            );
          }
        }
      }
    }

    if (mismatches.length > 0) {
      const errorMessage = [
        "Activity type mismatches found between webhooks.json and workflow-v1.0.json:",
        "",
        ...mismatches,
        "",
        "To fix these mismatches:",
        "1. Check GitHub docs: https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows",
        "2. Verify the activity type is valid for workflow triggers",
        "3. Update the *-activity-type definition in workflow-parser/src/workflow-v1.0.json",
        "4. Update the description to list all supported activity types",
        "5. If there's a naming difference, add it to NAME_MAPPINGS in schema-sync.test.ts",
        "6. If the type is webhook-only, add it to WEBHOOK_ONLY",
        "7. If the type is schema-only, add it to SCHEMA_ONLY"
      ].join("\n");

      throw new Error(errorMessage);
    }
  });
});
