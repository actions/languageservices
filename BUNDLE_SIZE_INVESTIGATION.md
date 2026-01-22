# Bundle Size Investigation

## Current State

**Package sizes on disk (in github-ui node_modules):**
- `@actions/languageservice`: **7.9M** 
- `@actions/workflow-parser`: **1.5M**
- `@actions/expressions`: **560K**
- **Total: ~10M**

**Largest files:**
| File | Size | % of total |
|------|------|------------|
| `languageservice/dist/context-providers/events/webhooks.json` | 6.2M | 62% |
| `languageservice/dist/context-providers/events/objects.json` | 948K | 9.5% |
| `workflow-parser/dist/workflow-v1.0.json` | 112K | 1% |
| `languageservice/dist/context-providers/descriptions.json` | 20K | <1% |

## JSON File Analysis

### What `webhooks.json` is used for

Provides autocomplete and validation for `github.*` context expressions. When you type `${{ github.event.` the language service uses this data to:
- Suggest available properties based on event type (push, pull_request, etc.)
- Provide descriptions for hover tooltips
- Validate property access is valid for the event type

### Field usage analysis

| Field | Location | Size | Used for Autocomplete | Used for Validation | Used for Hover |
|-------|----------|------|----------------------|---------------------|----------------|
| `bodyParameters[].description` | Inside each param | Part of bodyParams | ✅ Documentation popup | ✅ Property existence | ✅ Descriptions |
| `bodyParameters[].name/type/etc` | Inside each param | 1.55 MB total | ✅ Property names | ✅ Property existence | ✅ Structure |
| `description` | Top-level on event | 17 KB | ❌ Defined but unused | ❌ | ❌ |
| `summary` | Top-level on event | 155 KB | ❌ | ❌ | ❌ |
| `availability` | Top-level on event | 7 KB | ❌ | ❌ | ❌ |
| `category` | Top-level on event | 3 KB | ❌ | ❌ | ❌ |
| `action` | Top-level on event | 2 KB | ❌ | ❌ | ❌ |

**Key insight:** `bodyParameters` (including nested `description` fields) is used for ALL features. The **top-level** fields (`summary`, `description`, `availability`, `category`, `action`) are defined in the TypeScript types but never actually accessed in code - they can be stripped.

### Why top-level `description`/`summary` shouldn't be used for workflow events

**Question:** Could we use the webhooks.json top-level `description` or `summary` fields to enhance autocomplete/hover for the `on:` field?

**Answer:** No - they serve different purposes and the existing solution is better.

**Comparison:**

| Source | Example for `push` | Purpose |
|--------|-------------------|---------|
| `workflow-v1.0.json` (current) | "Runs your workflow when you push a commit or tag." | **User-facing** - explains what triggers the workflow |
| `webhooks.json` description | "A push was made to a repository branch..." | **API-facing** - describes the GitHub API event |
| `webhooks.json` summary | "This event occurs when a commit or tag is pushed. To subscribe to this event, a GitHub App must have at least read-level access..." | **App developer-facing** - API permissions info |

**The current solution is correct:**
- `workflow-v1.0.json` contains workflow-specific event descriptions written for GitHub Actions users
- These are shown in autocomplete/hover when completing `on: push`, `on: pull_request`, etc.
- Located in `languageservice/src/value-providers/definition.ts` line 46: `description: def.description`

**The webhooks.json descriptions would be wrong:**
- Written for GitHub App developers, not GitHub Actions users  
- Include irrelevant details (API permissions, subscription info)
- Don't explain what happens in the context of a workflow

**Conclusion:** Keep the top-level fields stripped - they're not needed and would be confusing if used.

### Minification analysis

| File | Pretty Size | Minified Size | Savings |
|------|-------------|---------------|---------|
| `webhooks.json` | 4.1 MB | 1.6 MB | **2.5 MB (60.5%)** |
| `objects.json` | 666 KB | 325 KB | **341 KB (51.3%)** |
| `workflow-v1.0.json` | 91 KB | 70 KB | **22 KB (23.5%)** |

**The files are NOT minified!** Just minifying saves 60%.

### Compression analysis (gzip)

Production servers typically gzip assets. Here's what matters for network transfer:

| File | Original | Minified | Gzipped | Min+Gzip |
|------|----------|----------|---------|----------|
| `webhooks.json` | 4.0 MB | 1.6 MB | 198 KB | **90 KB** |
| `objects.json` | 651 KB | 317 KB | 38 KB | **23 KB** |
| `workflow-v1.0.json` | 91 KB | 70 KB | 13 KB | **13 KB** |

**What matters for different concerns:**

| Concern | What matters |
|---------|--------------|
| **Network transfer** | Compressed size (gzip/brotli) - already small (~126 KB total) |
| **npm package size** | Uncompressed size on disk - affects install times |
| **Memory usage** | Parsed JSON object size in memory |
| **Parse time** | Uncompressed size (must decompress before parsing) |

**Key insight:** Network transfer is NOT the main concern (~126 KB gzipped). Minifying still matters for:
- Smaller npm package size (better install times)
- Less to decompress on client
- Faster JSON parsing (less text to parse)

## How the files are generated

The JSON files are **auto-generated** from GitHub's official REST API description:

```
npm run update-webhooks
```

**Source:** `github:github/rest-api-description` (GitHub's OpenAPI spec)

**Generation script:** `languageservice/script/webhooks/index.ts`
- Reads webhook definitions from the dereferenced OpenAPI schema
- Extracts body parameters, descriptions, summaries
- Runs deduplication to create `objects.json` (shared parameters stored once, referenced by index)
- Outputs pretty-printed JSON (not minified)

**Current deduplication strategy (`deduplicate.ts`):**
- Finds body parameters that appear in multiple webhooks
- Stores them once in `objects.json` array
- Replaces duplicates with numeric index references in `webhooks.json`

**Optimization opportunities in generation:**
1. Add minification step (remove whitespace) - easy, ~60% savings
2. Strip unused fields (`summary`, `availability`, `category`, `action`) - ~10% additional savings
3. Consider more aggressive deduplication (e.g., dedupe descriptions, nested objects)

### `workflow-v1.0.json` (workflow schema)

**Hand-authored** - not generated. Located in `workflow-parser/src/`.

Optimization: Minify at build time (112K pretty → smaller minified).

### Other Small JSON Files

| File | Purpose | Pretty | Minified | Further Optimized |
|------|---------|--------|----------|-------------------|
| `descriptions.json` | Hover descriptions for contexts/functions | 18 KB | 17 KB | N/A (all used) |
| `schedule.json` | Sample `github.event` for schedule trigger | 5.7 KB | 5.1 KB | **1.8 KB** (strip values) |
| `workflow_call.json` | Sample `github.event` for reusable workflows | 7.3 KB | 6.5 KB | **2.3 KB** (strip values) |

**Why `schedule.json` / `workflow_call.json` exist:**

These events are NOT webhooks - they're internal GitHub Actions triggers that don't appear in the REST API webhook definitions. The files provide sample `github.event` payloads so the language service knows what properties to autocomplete:

```
User types: ${{ github.event.repository.owner.login }}
                              ↑
Language service walks schedule.json to find valid property names
```

The code (`eventPayloads.ts` lines 109-116) uses `mergeObject()` to recursively extract property **names** - the actual values are never used.

**Key insight for `schedule.json` / `workflow_call.json`:** These files provide sample event payloads. The code only uses property **names** (for autocomplete like `github.event.repository.owner.login`), not values. The actual values (URLs, IDs, emails) can be replaced with `null`:

```javascript
// Original (5.1 KB)
{"repository":{"id":186853002,"name":"Hello-World","owner":{"login":"Codertocat",...},...},...}

// Stripped (1.8 KB) - same autocomplete functionality
{"repository":{"id":null,"name":null,"owner":{"login":null,...},...},...}
```

**Savings:** ~65% smaller for these files.

## JSON File Maintenance & Documentation

### TODO: Document maintenance procedures

| File | Source | How to Update | Documented? |
|------|--------|---------------|-------------|
| `webhooks.json` + `objects.json` | `npm run update-webhooks` from `rest-api-description` | Run script | ⚠️ Partial (in script) |
| `workflow-v1.0.json` | Hand-authored | Manual edits | ❌ No |
| `descriptions.json` | Hand-authored | Manual edits | ❌ No |
| `schedule.json` | Hand-authored sample payload | Manual edits | ❌ No - unclear origin |
| `workflow_call.json` | Hand-authored sample payload | Manual edits | ❌ No - unclear origin |

### Historical context (from git history):

- **`schedule.json`** - Added in commit `b68ac91` (Dec 2022) by Beth Brennan in "Use payload schema for events"
  - Uses "Codertocat/Hello-World" sample data (appears to be from GitHub's webhook documentation examples)
  - No documentation on where this came from or how to update it
  - **Question:** Is this based on a real scheduled workflow run? How do we know it includes all possible properties?

- **`workflow_call.json`** - Same commit, similar questions

- **Many other event JSON files** were added in that same commit, but were later replaced by the generated `webhooks.json` system. Only `schedule.json` and `workflow_call.json` remain as manual files because they're not real webhooks.

### Questions to answer:

1. **`schedule.json`** - Where did this sample payload come from? Is it based on a real event? How do we know it's complete/accurate? Does it need updating when GitHub adds new repository properties?

2. **`workflow_call.json`** - Same questions. Was this captured from an actual workflow run?

3. **`descriptions.json`** - Are these descriptions synced from docs.github.com or manually maintained? How do we keep them up to date?

4. **`workflow-v1.0.json`** - What's the process for adding new workflow syntax (new keys, new event types)?

### Recommended actions:

1. **Add README files** - Each JSON file should have documentation explaining what it's for, how to update it, and who maintains it

2. **Automate where possible** - Could `schedule.json` be generated from a real scheduled workflow run's `github.event`? Could we capture a sample automatically?

3. **Add tests** - Validate that sample payloads match expected structure

### ⚠️ BUG: `workflow_call.json` may be incorrect/useless

**Finding:** For `on: workflow_call` (reusable workflows), the `github.event` context is **inherited from the calling workflow**. If the caller was triggered by `push`, then `github.event` contains push data. If by `pull_request`, it contains PR data.

**Current behavior in `github.ts`:**
```typescript
// Line 87-89 - For VALIDATION mode, returns Null (any value allowed)
if (eventsConfig.workflow_call && mode == Mode.Validation) {
  return new data.Null();
}

// But for COMPLETION/HOVER mode, falls through and uses workflow_call.json!
```

**Problem:** `workflow_call.json` contains generic repo/sender/org data, but this is WRONG for autocomplete. When you type `${{ github.event.` in a reusable workflow, showing `repository`, `sender`, etc. is misleading because:
- The actual properties depend on how the workflow was called
- Could be push properties, PR properties, or anything else

**Recommendation:** 
- Either return `Null` for completion/hover too (show nothing, since we can't know)
- Or remove `workflow_call.json` entirely since it's actively misleading
- This would save 7KB and fix a bug!

## npm Package Sizes

The actual npm package sizes (gzipped tarballs) are much smaller than disk size:

| Package | Disk Size | Package Size (gzipped) | Unpacked |
|---------|-----------|------------------------|----------|
| `@actions/languageservice` | 7.9M | **368 KB** | 7.7 MB |
| `@actions/workflow-parser` | 1.5M | **98 KB** | 548 KB |
| `@actions/expressions` | 560K | **34 KB** | 153 KB |
| **Total** | ~10M | **~500 KB** | ~8.4 MB |

**Key insight:** npm install downloads ~500KB gzipped. The disk/memory impact is ~8.4 MB unpacked.

## Dependencies Analysis

**Direct dependencies:**

| Package | Disk Size | Used By | Notes |
|---------|-----------|---------|-------|
| `yaml` | 1.4 MB | workflow-parser, languageservice | Full YAML parser, well-structured |
| `cronstrue` | 1.4 MB | workflow-parser | Cron → human text. Main: 44KB (no i18n) |
| `vscode-languageserver-types` | 396 KB | languageservice | Type definitions for LSP |
| `vscode-languageserver-textdocument` | 72 KB | languageservice | Text document handling |
| `vscode-uri` | 256 KB | languageservice | URI parsing |

**Observations:**
- `cronstrue` has a 44KB main entry (without i18n) vs 238KB with i18n. Bundlers should use the smaller one.
- `yaml` is necessary - no lighter alternative for full YAML parsing
- `vscode-*` packages are minimal and necessary for LSP compatibility

## Areas to Investigate

1. ✅ **Total bundle size** - Analyzed above
2. ✅ **Specific heavy dependencies** - `cronstrue` and `yaml` analyzed
3. **Tree-shaking** - Whether unused code is being properly eliminated
4. ✅ **Load time impact** - Lazy-loaded in github-ui via dynamic import()
5. ✅ **JSON files for event validation** - Main culprit (6.2MB webhooks.json)
6. ✅ **Minifying the workflow schema JSON file** - 112K → can be minified

## Potential Optimizations

### High Impact

1. **Drop 31 unused webhook events** - Events like `installation`, `marketplace_purchase`, `sponsorship`, `star`, `team`, etc. are in `webhooks.json` but cannot be used as workflow triggers. Confirmed against [GitHub's official docs](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows).

   | Metric | Before | After | Savings |
   |--------|--------|-------|---------|
   | Events | 63 | 32 | 31 dropped |
   | Size | 1.76 MB | 1.42 MB | **19%** |

   **Events to drop:**
   ```
   code_scanning_alert, commit_comment, dependabot_alert, deploy_key,
   github_app_authorization, installation, installation_repositories,
   installation_target, marketplace_purchase, member, membership, meta,
   org_block, organization, package, ping, projects_v2, projects_v2_item,
   pull_request_review_thread, repository, repository_import,
   repository_vulnerability_alert, secret_scanning_alert,
   secret_scanning_alert_location, security_advisory, security_and_analysis,
   sponsorship, star, team, team_add, workflow_job
   ```

2. **Strip unused fields** - Remove `summary`, `availability`, `category`, `action` fields that are never used by the language service. Only `bodyParameters` and `descriptionHtml` are needed.

3. **Minify JSON files** - Currently pretty-printed with whitespace. Minifying saves ~60%.

4. **Combined impact estimate:**

   | Optimization | webhooks.json | objects.json |
   |--------------|---------------|--------------|
   | Original | 6.2 MB | 948 KB |
   | Drop unused events | 5.0 MB (-19%) | 770 KB (-19%) |
   | Strip unused fields | 3.0 MB (-40%) | 460 KB (-40%) |
   | Minify | 1.2 MB (-60%) | 225 KB (-52%) |
   | **Gzipped (network)** | **~60 KB** | **~20 KB** |

5. **Add `"sideEffects"` to all package.json files** - Enable tree-shaking across all packages:
   - `expressions/package.json`: `"sideEffects": false`
   - `workflow-parser/package.json`: `"sideEffects": false`
   - `languageservice/package.json`: `"sideEffects": ["./dist/context-providers/events/eventPayloads.js"]`

### Medium Impact

6. **Minify `workflow-v1.0.json` schema (112K)** - Strip whitespace. Note: This file is hand-authored, not generated from webhook data.

7. **Minify and strip small JSON files** - `schedule.json`, `descriptions.json`:
   - Minify all (remove whitespace)
   - Strip values from `schedule.json` (only property names are used)

8. **Investigate `workflow_call.json` usage** - See bug section above. This file may be incorrect/useless:
   - For `on: workflow_call`, `github.event` is inherited from the calling workflow
   - Current code returns `Null` for validation (correct) but uses `workflow_call.json` for completion (incorrect?)
   - Options: Remove file entirely, or fix code to return `Null` for all modes
   - Saves 7KB + potentially fixes misleading autocomplete

9. **Lazy-load event validation data** - Refactor `eventPayloads.ts` to load JSON on first use instead of at import time.

### Low Impact / Further Investigation

10. **Tree-shake unused exports** - Ensure webpack is eliminating dead code.

11. **Evaluate `cronstrue` size** - Check if it's worth keeping or replacing with lighter alternative.

11. **Bundle analysis** - Run webpack-bundle-analyzer to see actual bundled sizes after minification/compression.

## Implementation Plan

### Phase 1: Update generation script (`languageservice/script/webhooks/index.ts`)

1. Add list of valid workflow trigger events (whitelist)
2. Filter out events not in whitelist during generation
3. Strip unused fields (`summary`, `availability`, `category`, `action`) 
4. Output minified JSON (`JSON.stringify(data)` instead of `JSON.stringify(data, null, 2)`)

### Phase 1b: Minify/optimize small hand-authored JSON files

1. Minify `descriptions.json` (18 KB → 17 KB)
2. Strip values & minify `schedule.json` (5.7 KB → 1.8 KB)
3. Strip values & minify `workflow_call.json` (7.3 KB → 2.3 KB)
4. Minify `workflow-v1.0.json` (112 KB → ~90 KB)

### Phase 2: Add sideEffects to all package.json files

1. Add `"sideEffects": false` to `expressions/package.json`
2. Add `"sideEffects": false` to `workflow-parser/package.json`
3. Add `"sideEffects": ["./dist/context-providers/events/eventPayloads.js"]` to `languageservice/package.json`

### Phase 3: (Optional) Refactor for lazy loading

1. Move JSON imports inside functions
2. Remove top-level hydration code, make it lazy

### Phase 4: Automated JSON updates via GitHub Actions

Create workflows to automatically keep JSON files up to date:

#### 4a: Webhook JSON auto-update workflow

```yaml
# .github/workflows/update-webhooks.yml
name: Update webhook definitions
on:
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday
  workflow_dispatch:      # Manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run update-webhooks
      - name: Create PR if changes
        uses: peter-evans/create-pull-request@v5
        with:
          title: "chore: Update webhook definitions"
          body: |
            Automated update from `rest-api-description` package.
            
            This PR was created automatically by the update-webhooks workflow.
          branch: auto/update-webhooks
          delete-branch: true  # Delete old branch, creates fresh PR each time
          commit-message: "chore: Update webhook definitions"
```

#### 4b: Schedule/workflow_call JSON auto-update workflow

Create a workflow that runs an actual scheduled workflow and captures `github.event`:

```yaml
# .github/workflows/capture-schedule-payload.yml
name: Capture schedule event payload
on:
  schedule:
    - cron: '0 0 1 * *'  # Monthly on the 1st
  workflow_dispatch:

jobs:
  capture:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Capture github.event
        run: |
          echo '${{ toJSON(github.event) }}' > /tmp/schedule-event.json
          # Strip to just property structure (values → null)
          node -e "
            const fs = require('fs');
            const strip = (o) => {
              if (Array.isArray(o)) return o.length ? [strip(o[0])] : [];
              if (o && typeof o === 'object') return Object.fromEntries(
                Object.entries(o).map(([k,v]) => [k, strip(v)])
              );
              return null;
            };
            const data = JSON.parse(fs.readFileSync('/tmp/schedule-event.json'));
            const stripped = strip(data);
            fs.writeFileSync(
              'languageservice/src/context-providers/events/schedule.json',
              JSON.stringify(stripped, null, 2)
            );
          "
      
      - name: Create PR if changes
        uses: peter-evans/create-pull-request@v5
        with:
          title: "chore: Update schedule.json payload structure"
          body: |
            Captured fresh `github.event` structure from a real scheduled workflow run.
            
            This ensures autocomplete suggestions match the actual event payload.
          branch: auto/update-schedule-json
          delete-branch: true
          commit-message: "chore: Update schedule.json from live event"
```

#### 4c: Workflow_call payload capture

Similar approach - create a reusable workflow that calls itself and captures `github.event`:

```yaml
# .github/workflows/capture-workflow-call-payload.yml  
name: Capture workflow_call event payload
on:
  workflow_call:
  workflow_dispatch:

jobs:
  capture:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Capture and update workflow_call.json
        if: github.event_name == 'workflow_call'
        run: |
          # Similar to schedule capture above
          echo '${{ toJSON(github.event) }}' | node -e "..." > workflow_call.json
      - name: Trigger self as reusable workflow
        if: github.event_name == 'workflow_dispatch'
        uses: ./.github/workflows/capture-workflow-call-payload.yml
```

**Benefits:**
- JSON files stay up to date automatically
- PRs are created for review (not auto-merged)
- Captures real event structures, not guessed samples
- Weekly/monthly schedule catches GitHub API changes

## Validation Stages Analysis

The current `validate()` function does everything in one pass. We could split it into stages that load progressively:

### Current Loading Cascade

```
validate() called
  └─ imports workflow-parser
      └─ imports workflow-v1.0.json (112KB) ← loaded immediately
  └─ parseWorkflow() → YAML parse + schema validation
  └─ additionalValidations()
      └─ getContext() → imports github.ts
          └─ imports eventPayloads.ts
              └─ imports webhooks.json (6.2MB) ← loaded immediately
```

### Potential Validation Stages

| Stage | What it validates | Data needed | Size |
|-------|-------------------|-------------|------|
| **1. YAML Syntax** | Valid YAML? Quotes closed? Indentation? | YAML parser (bundled) | ~0 |
| **2. Workflow Schema** | Valid `jobs:`, `steps:`, `runs-on:`? | `workflow-v1.0.json` | 112KB |
| **3. Expression Syntax** | Valid `${{ }}` syntax? Functions exist? | Expression parser | ~0 |
| **4. Context Validation** | `github.sha`, `env.FOO` exist? | Just code | ~0 |
| **5. Event Payload Validation** | `github.event.pull_request.title` exists? | `webhooks.json` | 6.2MB |

### Key Insight

Stages 1-4 can run with minimal data (~112KB). Only Stage 5 needs the 6.2MB webhook data.

**Expression syntax** (`${{ secrets.FOO }}`) is different from **event payload validation** (`${{ github.event.issue.number }}`):
- Expression syntax: Is this a valid expression? Does the function exist?
- Event payload: Does this specific property exist on the `pull_request` event?

### Options for Progressive Loading

**Option A: Lazy load webhooks.json (simplest)**
```typescript
// eventPayloads.ts - defer import until first use
let webhooksData: Webhooks | null = null;
async function getWebhooks() {
  if (!webhooksData) {
    const { default: data } = await import("./webhooks.json");
    webhooksData = data;
  }
  return webhooksData;
}
```
- Pro: Minimal code changes
- Con: Still blocks when github.event.* is first accessed

**Option B: Multi-pass validation in languageservice**
```typescript
// New exports from @actions/languageservice
export { validateSchema } from "./validate-schema";           // Fast
export { validateExpressions } from "./validate-expressions"; // Needs webhooks
export { validate } from "./validate";                        // Combined (current)
```
- Pro: Clean API, consumer controls loading
- Con: More work, API change

**Option C: Multi-pass validation in github-ui**
```typescript
// github-ui can show partial results
const schemaErrors = await validate(doc);  // Returns what it can immediately
// Later, more errors may arrive as webhooks.json loads
```
- Pro: No languageservice changes
- Con: Complex state management in consumer

### Recommendation

1. **Phase 1**: Minify + strip unused data (reduce 6.2MB → ~1.2MB)
2. **Phase 2**: Lazy load webhooks.json in `eventPayloads.ts`
3. **Phase 3** (future): Consider multi-pass API if needed

The lazy loading approach gives 90% of the benefit with 10% of the complexity.

## Side Effects Analysis

Need to verify the packages have no side effects before adding `"sideEffects": false`:

- [x] `@actions/languageservice` - Has ONE file with side effects
- [x] `@actions/workflow-parser` - ✅ No side effects  
- [x] `@actions/expressions` - ✅ No side effects

Common side effects to look for:
- Top-level function calls (not just definitions)
- Modifying global objects (`Object.prototype`, `window`, etc.)
- Polyfills
- CSS imports (not applicable here)

### JSON Files Imported at Top Level

| Package | File | JSON Imported | Size | Has Side Effects? |
|---------|------|---------------|------|-------------------|
| languageservice | `eventPayloads.ts` | `webhooks.json` | 6.2 MB | ⚠️ YES (mutation) |
| languageservice | `eventPayloads.ts` | `objects.json` | 948 KB | ⚠️ YES (mutation) |
| languageservice | `eventPayloads.ts` | `schedule.json` | 6 KB | ⚠️ YES (mutation) |
| languageservice | `eventPayloads.ts` | `workflow_call.json` | 8 KB | ⚠️ YES (mutation) |
| languageservice | `descriptions.ts` | `descriptions.json` | 20 KB | ❌ No |
| workflow-parser | `workflow-schema.ts` | `workflow-v1.0.json` | 112 KB | ❌ No |
| expressions | (none) | (none) | - | ❌ No |

### Findings

**`@actions/expressions`** - ✅ No side effects
- No JSON imports
- No top-level code execution
- Can use `"sideEffects": false`

**`@actions/workflow-parser`** - ✅ No side effects
- `workflow-schema.ts` imports `workflow-v1.0.json` at top level BUT:
  - Only exports a function `getWorkflowSchema()` with lazy initialization
  - No top-level function calls or mutations
- Can use `"sideEffects": false`

**`@actions/languageservice`** - ⚠️ HAS ONE FILE with side effects

`descriptions.ts` - ❌ No side effects
- Imports `descriptions.json` (20KB) at top level
- Only exports functions, no top-level execution

`eventPayloads.ts` - ⚠️ HAS SIDE EFFECTS
```typescript
// Lines 3-7: JSON imports at top level (7.2MB total)
import webhookObjects from "./objects.json";
import webhooks from "./webhooks.json";
import schedule from "./schedule.json";
import workflow_call from "./workflow_call.json";

// Lines 85-93: Executes at module load time, mutates data
getWebhookPayload("workflow_dispatch", "default");
const inputs = webhookPayloads?.["workflow_dispatch"]?.["default"].bodyParameters.find(p => p.name === "inputs");
if (inputs) {
  delete inputs.childParamsGroups;
}
```

### Recommended `sideEffects` Configuration

**`expressions/package.json`:**
```json
"sideEffects": false
```

**`workflow-parser/package.json`:**
```json
"sideEffects": false
```

**`languageservice/package.json`:**
```json
"sideEffects": ["./dist/context-providers/events/eventPayloads.js"]
```

**Impact:** Allows webpack to tree-shake unused exports. Without this, webpack assumes all imports may have side effects and keeps everything.

### Optional: Refactor `eventPayloads.ts` to Remove Side Effects

To allow `"sideEffects": false` for the entire languageservice package, refactor the mutation code:

```typescript
// Before: Top-level mutation
getWebhookPayload("workflow_dispatch", "default");
const inputs = webhookPayloads?.["workflow_dispatch"]?.["default"].bodyParameters.find(p => p.name === "inputs");
if (inputs) {
  delete inputs.childParamsGroups;
}

// After: Lazy initialization inside function
let initialized = false;
function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  // ... mutation code here
}

export function getEventPayload(...) {
  ensureInitialized();
  // ... rest of function
}
```

This would allow full tree-shaking AND defer the 7.2MB JSON load until first use.
