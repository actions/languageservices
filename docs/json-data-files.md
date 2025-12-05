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
