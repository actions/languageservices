# JSON Data Files

This document describes the JSON data files used by the language service packages and how they are maintained.

## Overview

The language service uses several JSON files containing schema definitions, webhook payloads, and other metadata. To reduce bundle size, these files are:

1. **Optimized at generation time** — unused events are dropped, unused fields are stripped
2. **Minified at build time** — whitespace is removed to produce `.min.json` files

The source `.json` files are human-readable and checked into the repository. The `.min.json` files are generated during build and gitignored.

## Files

### languageservice

| File | Description |
|------|-------------|
| `src/context-providers/events/webhooks.json` | Webhook event payload schemas for autocompletion |
| `src/context-providers/events/objects.json` | Deduplicated shared object definitions referenced by webhooks |
| `src/context-providers/events/schedule.json` | Schedule event context data |
| `src/context-providers/events/workflow_call.json` | Reusable workflow call context data |
| `src/context-providers/descriptions.json` | Context variable descriptions for hover |

### workflow-parser

| File | Description |
|------|-------------|
| `src/workflow-v1.0.json` | Workflow YAML schema definition |

## Generation

### Webhooks and Objects

The `webhooks.json` and `objects.json` files are generated from the [GitHub REST API description](https://github.com/github/rest-api-description):

```bash
cd languageservice
npm run update-webhooks
```

This script:
1. Fetches webhook schemas from the GitHub API description
2. **Validates** all events are categorized (fails if new events are found)
3. **Drops** events that aren't valid workflow triggers (see [Dropped Events](#dropped-events))
4. **Strips** unused fields like `description` and `summary` (see [Stripped Fields](#stripped-fields))
5. **Deduplicates** shared object definitions into `objects.json`
6. Writes the optimized, pretty-printed JSON files

### Handling New Webhook Events

When GitHub adds a new webhook event, the script will fail with an error like:

```
ERROR: New webhook event(s) detected!

The following events are not categorized:
  - new_event_name

Action required:
  1. Check if the event is a valid workflow trigger
  2. Add the event to DROPPED_EVENTS or KEPT_EVENTS
```

**To resolve:**

1. Check [Events that trigger workflows](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows)

2. Edit `languageservice/script/webhooks/index.ts`:
   - Add to `KEPT_EVENTS` if it's a valid workflow trigger
   - Add to `DROPPED_EVENTS` if it's GitHub App or API-only

3. Run `npm run update-webhooks` and commit the changes

#### Viewing Full Unprocessed Data

To see all available fields and events before optimization:

```bash
npm run update-webhooks -- --all
```

This generates `webhooks.all.json` and `objects.all.json` (gitignored) containing the complete unprocessed data from the GitHub API.

### Other Files

The other JSON files (`schedule.json`, `workflow_call.json`, `descriptions.json`, `workflow-v1.0.json`) are manually maintained.

## Minification

At build time, all JSON files are minified (whitespace removed) to produce `.min.json` versions:

```bash
npm run minify-json
```

This runs automatically via `prebuild` and `pretest` hooks, so you don't need to run it manually.

The code imports the minified versions:

```ts
import webhooks from "./events/webhooks.min.json"
```

## CI Verification

CI verifies that generated source files are up-to-date:

1. Runs `npm run update-webhooks` to regenerate webhooks.json and objects.json
2. Checks for uncommitted changes with `git diff --exit-code`

The `.min.json` files are generated at build time and are not committed to the repository.

If the build fails, run `cd languageservice && npm run update-webhooks` locally and commit the changes.

## Dropped Events

Webhook events that aren't valid workflow `on:` triggers are dropped (e.g., `installation`, `ping`, `member`, etc.). These are GitHub App or API-only events.

See `DROPPED_EVENTS` in `script/webhooks/index.ts` for the full list.

## Stripped Fields

Unused fields are stripped to reduce bundle size. For example:

```json
// Before (from webhooks.all.json)
{
  "type": "object",
  "name": "issue",
  "in": "body",
  "description": "The issue itself.",
  "isRequired": true,
  "childParamsGroups": [...]
}

// After (webhooks.json)
{
  "name": "issue",
  "description": "The issue itself.",
  "childParamsGroups": [...]
}
```

Only `name`, `description`, and `childParamsGroups` are kept — these are used for autocompletion and hover docs.

To compare all fields vs stripped, run `npm run update-webhooks -- --all` and diff the `.all.json` files against the regular ones.

See `EVENT_ACTION_FIELDS` and `BODY_PARAM_FIELDS` in `script/webhooks/index.ts` to modify what gets stripped.

## Schema Synchronization

The `workflow-v1.0.json` schema defines which activity types are valid for each workflow trigger event. A test in `workflow-parser/src/schema-sync.test.ts` verifies these stay in sync with `webhooks.json`.

### When the Test Fails

If the schema-sync test fails, you'll see an error like:

```
Event "pull_request" is missing activity type "new_activity" in workflow-v1.0.json
```

**To resolve:**

1. Check [Events that trigger workflows](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows) to verify the activity type is a valid workflow trigger:
   - Find the event section (e.g., "pull_request")
   - Look at the "Activity types" table — it lists which types can be used in `on.<event>.types`
   - If the type is listed there, it's a valid workflow trigger
   - If the type only appears in webhook docs but NOT in the workflow trigger docs, it's webhook-only

2. If it IS a valid workflow trigger:
   - Edit `workflow-parser/src/workflow-v1.0.json`
   - Find the `<event>-activity-type` definition (e.g., `pull-request-activity-type`)
   - Add the new activity type to `allowed-values`
   - Update the `description` in `<event>-activity` to list all types
   - Run `npm test` to regenerate the minified JSON

3. If it is NOT a valid workflow trigger (webhook-only):
   - Edit `workflow-parser/src/schema-sync.test.ts`
   - Add the type to `WEBHOOK_ONLY` for that event

### Known Discrepancies

The test tracks several types of known discrepancies:

| Category | Purpose | Example |
|----------|---------|---------|
| `WEBHOOK_ONLY` | Types in webhooks that aren't valid workflow triggers | `check_suite.requested` |
| `SCHEMA_ONLY` | Types valid for workflows but missing from webhooks | `registry_package.updated` |
| `NAME_MAPPINGS` | Different names for the same concept | `project_column`: webhook uses `edited`, schema uses `updated` |

### Bidirectional Checking

The test checks both directions:
- **webhooks → schema**: Ensures all webhook activity types are in the schema (or listed in `WEBHOOK_ONLY`)
- **schema → webhooks**: Ensures the schema doesn't have types that don't exist in webhooks (or listed in `SCHEMA_ONLY` or `NAME_MAPPINGS`)
