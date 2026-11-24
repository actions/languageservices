# Bundle Size Optimization Plan

## Goal

Reduce `@actions/languageservice` package size from **7.9 MB** to **~1.5 MB** (80% reduction).

## Summary

| Phase | Change | Savings | Effort |
|-------|--------|---------|--------|
| 1a | Minify all JSON | 60% | Low |
| 1b | Strip unused fields | 10% | Low |
| 1c | Drop unused events | 19% | Low |
| 2 | Lazy-load webhooks.json (optional) | Faster initial load | Medium |

## Phase 1: Optimize JSON files

### What each JSON file is used for

| File | Package | Purpose |
|------|---------|---------|
| `webhooks.json` | languageservice | Autocomplete/validation for `github.event.*` expressions. Contains event payload schemas from GitHub's REST API. |
| `objects.json` | languageservice | Deduplicated parameter definitions shared across webhooks (reduces duplication in webhooks.json). |
| `workflow-v1.0.json` | workflow-parser | Workflow schema defining valid YAML structure (`jobs`, `steps`, `runs-on`, event triggers, etc.). |
| `descriptions.json` | languageservice | Hover descriptions for contexts (`github`, `env`, `secrets`) and built-in functions (`format`, `contains`, etc.). |
| `schedule.json` | languageservice | Sample `github.event` payload for `on: schedule` trigger (not a real webhook, manually authored). |
| `workflow_call.json` | languageservice | Sample `github.event` payload for `on: workflow_call` trigger (not a real webhook, manually authored). |

### Impact table

| File | Original | Strip | Drop | Minify | Gzip | All (no Gzip) | All (w/ Gzip) |
|------|----------|-------|------|--------|------|---------------|---------------|
| `webhooks.json` | 6.2 MB | 5.6 MB | 5.0 MB | 2.4 MB | 188 KB | **1.0 MB** | **50 KB** |
| `objects.json` | 948 KB | N/A | 770 KB | 460 KB | 36 KB | **180 KB** | **18 KB** |
| `workflow-v1.0.json` | 112 KB | N/A | N/A | 70 KB | 13 KB | **70 KB** | **12 KB** |
| `descriptions.json` | 18 KB | N/A | N/A | 17 KB | 3 KB | **17 KB** | **3 KB** |
| `schedule.json` | 5.7 KB | N/A | N/A | 5.1 KB | 1 KB | **5.1 KB** | **1 KB** |
| `workflow_call.json` | 7.3 KB | N/A | N/A | 6.5 KB | 1 KB | **6.5 KB** | **1 KB** |
| **Total** | **7.3 MB** | | | | **~240 KB** | **~1.3 MB** | **~85 KB** |

- **Strip** = Remove unused fields (`summary`, `availability`, `category`, `action`)
- **Drop** = Remove 31 non-trigger events (`installation`, `star`, `team`, etc.)
- **Minify** = Remove whitespace (`JSON.stringify(data)` instead of `JSON.stringify(data, null, 2)`)
- **Gzip** = Network transfer size (free - handled automatically by browser/server)

### 1a. Minify all JSON files

**Generated files** (`webhooks.json`, `objects.json`):
- Update `languageservice/script/webhooks/index.ts`
- These are generated via `npm run update-webhooks` from GitHub's REST API spec
- Use `JSON.stringify(data)` instead of `JSON.stringify(data, null, 2)`

**Hand-authored files** (`workflow-v1.0.json`, `descriptions.json`, `schedule.json`, `workflow_call.json`):
- Add minification step to build scripts

### 1b. Strip unused fields from webhooks.json

Remove before writing:
- `summary`
- `availability`  
- `category`
- `action`

### 1c. Drop non-trigger events from webhooks.json

Keep only events that can trigger workflows ([docs](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows)). Drop 31 events:

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

**Expected result:** Total JSON 7.3 MB → ~1.3 MB (82% reduction)

---

## Phase 2: Lazy loading (optional)

Refactor `eventPayloads.ts` to load JSON on first use:

```typescript
let webhooksData: Webhooks | null = null;

async function getWebhooks() {
  if (!webhooksData) {
    const { default: data } = await import("./webhooks.json");
    webhooksData = hydrate(data);
  }
  return webhooksData;
}
```

**Benefit:** Faster initial load when `github.event.*` isn't used.

---

## Current github-ui architecture

github-ui lazy-loads the language service via dynamic import:

```typescript
// workflow-editor-next.ts
let languageServicePromise: Promise<typeof import('./workflow-editor-language-service')> | null = null

async function getLanguageServiceModule() {
  if (!languageServicePromise) {
    languageServicePromise = import('./workflow-editor-language-service')
  }
  return languageServicePromise
}
```

**What this means:**
- The language service is only loaded when the workflow editor needs autocomplete/hover/validation
- Webpack code-splits it into a separate chunk
- The ~7.9 MB package is NOT loaded on initial page load

**Why Phase 1 is the priority:**
- When the language service chunk IS loaded, it still loads all 7.3 MB of JSON
- Reducing JSON to ~1.3 MB directly reduces this chunk size
- No changes needed in github-ui - the benefit is automatic

---

## Not doing

- **Tree-shaking / `sideEffects`** - github-ui imports `complete`, `hover`, and `validate` together, and all three depend on the same webhook JSON. Tree-shaking can't eliminate any of it.
- **Replacing dependencies** - `yaml` and `cronstrue` are appropriately sized
- **Multi-pass validation API** - Too complex for the benefit
- **Further deduplication** - Current object deduplication is sufficient

---

## Future considerations

- **`workflow_call.json` may be incorrect** - For `on: workflow_call`, `github.event` is inherited from the calling workflow (could be push, pull_request, etc.). The current file shows generic properties which may be misleading for autocomplete. Consider returning `Null` for all modes or removing the file entirely.

---

## Success metrics

| Metric | Before | After |
|--------|--------|-------|
| `webhooks.json` | 6.2 MB | ~1.2 MB |
| `objects.json` | 948 KB | ~225 KB |
| Total package (disk) | 7.9 MB | ~1.5 MB |
| npm tarball (gzipped) | 368 KB | ~80 KB |
