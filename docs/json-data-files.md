# JSON Data Files

This document describes the JSON data files used by the language service packages and how they are maintained.

## Overview

The language service uses several JSON files containing schema definitions, webhook payloads, and other metadata. To reduce bundle size, these files are:

1. **Optimized at generation time** — unused events are dropped, unused fields are stripped, shared objects are deduplicated, property names are interned
2. **Compacted using a space-efficient format** — params use type-based dispatch arrays instead of objects
3. **Minified at build time** — whitespace is removed to produce `.min.json` files

The source `.json` files are human-readable and checked into the repository. The `.min.json` files are generated during build and gitignored.

## Files

### languageservice

| File | Description |
|------|-------------|
| `src/context-providers/events/webhooks.json` | Webhook event payload schemas for autocompletion |
| `src/context-providers/events/webhooks.objects.json` | Deduplicated shared object definitions referenced by webhooks |
| `src/context-providers/events/webhooks.strings.json` | Interned property names shared by webhooks and objects |
| `src/context-providers/events/schedule.json` | Schedule event context data |
| `src/context-providers/events/workflow_call.json` | Reusable workflow call context data |
| `src/context-providers/descriptions.json` | Context variable descriptions for hover |

### workflow-parser

| File | Description |
|------|-------------|
| `src/workflow-v1.0.json` | Workflow YAML schema definition |

## Generation

### Webhooks and Objects

The `webhooks.json`, `webhooks.objects.json`, and `webhooks.strings.json` files are generated from the [GitHub REST API description](https://github.com/github/rest-api-description):

```bash
cd languageservice
npm run update-webhooks
```

This script:
1. Fetches webhook schemas from the GitHub API description
2. **Validates** all events are categorized (fails if new events are found)
3. **Drops** events that aren't valid workflow triggers (see [Dropped Events](#dropped-events))
4. **Compacts** params into a space-efficient array format, keeping only `name`, `description`, and `childParamsGroups` (see [Compact Format](#compact-format))
5. **Deduplicates** shared object definitions into `webhooks.objects.json`
6. **Interns** duplicate property names into `webhooks.strings.json` (see [String Interning](#string-interning))
7. Writes the optimized, pretty-printed JSON files

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

2. Edit `languageservice/src/context-providers/events/event-filters.json`:
   - Add to `kept` array if it's a valid workflow trigger
   - Add to `dropped` array if it's GitHub App or API-only

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
import objects from "./events/webhooks.objects.min.json"
import strings from "./events/webhooks.strings.min.json"
```

## CI Verification

CI verifies that generated source files are up-to-date:

1. Runs `npm run update-webhooks` to regenerate webhooks.json, webhooks.objects.json, and webhooks.strings.json
2. Checks for uncommitted changes with `git diff --exit-code`

The `.min.json` files are generated at build time and are not committed to the repository.

If the build fails, run `cd languageservice && npm run update-webhooks` locally and commit the changes.

## Dropped Events

Webhook events that aren't valid workflow `on:` triggers are dropped (e.g., `installation`, `ping`, `member`, etc.). These are GitHub App or API-only events.

See `dropped` array in `src/context-providers/events/event-filters.json` for the full list.

## Compact Format

Params are converted from verbose objects into compact arrays, keeping only the fields needed for autocompletion and hover docs (`name`, `description`, `childParamsGroups`). Unused fields like `type`, `in`, `isRequired`, `enum`, and `default` are discarded.

| Format | Meaning |
|--------|---------|
| `"name"` | Name only (no description, no children) |
| `[name, desc]` | Name + description (arr[1] is a string) |
| `[name, children]` | Name + children (arr[1] is an array) |
| `[name, desc, children]` | Name + description + children |

The reader uses `typeof arr[1]` to determine the format: if it's a string, it's a description; if it's an array, it's children.

**Example:**

```json
// Before (object format)
{
  "name": "issue",
  "description": "The issue itself.",
  "childParamsGroups": [
    { "name": "id" },
    { "name": "title", "description": "Issue title" }
  ]
}

// After (compact format)
["issue", "The issue itself.", [
  "id",
  ["title", "Issue title"]
]]
```

## String Interning

Property names that appear 2+ times are "interned" into a shared string table (`webhooks.strings.json`). In the compact arrays, these names are replaced with non-negative numeric indices:

```json
// webhooks.strings.json
["url", "id", "name", ...]  // Index 0 = "url", 1 = "id", 2 = "name"

// webhooks.json - uses indices instead of strings
{
  "push": {
    "default": {
      "p": [
        [0, "The URL..."],  // 0 = "url" from string table
        [1, "Unique ID"],   // 1 = "id"
        2                   // 2 = "name" (name-only, no description)
      ]
    }
  }
}
```

**How to distinguish indices from other values:**

- **Negative numbers** → Object indices: `-1` = object 0, `-2` = object 1, etc. (formula: `-(index + 1)`)
- **Non-negative numbers** → String indices (references into `webhooks.strings.json`)
- **Literal strings** → Singletons (names appearing only once, not interned)

Singletons are kept as literal strings for readability and to avoid the overhead of adding rarely-used names to the string table.

## Deduplication

Shared object definitions are extracted into `webhooks.objects.json` and referenced by negative index:

```json
// webhooks.objects.json
[
  ["url", "The URL"],           // Index 0 (referenced as -1)
  ["id", "Unique identifier"],  // Index 1 (referenced as -2)
  [...]
]

// webhooks.json - negative numbers reference objects
{
  "push": {
    "default": {
      "p": [-1, -2, ["ref", "The git ref"]]  // -1 = object 0, -2 = object 1
    }
  }
}
```

This reduces duplication when the same object structure appears in multiple events (e.g., `repository`, `sender`, `organization`).

## Size Reduction

The optimizations achieve approximately 99% file size reduction:

| Stage | Minified | Gzip |
|-------|----------|------|
| Original (webhooks.full.json) | 15.8 MB | 968 KB |
| After optimization (combined) | 152 KB | 15.6 KB |
| **Reduction** | **99%** | **98%** |
