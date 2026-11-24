# JSON Optimization Summary

| File | Original | Strip | Minify | Gzip | Strip+Minify | Minify+Gzip | Strip+Minify+Gzip |
|------|----------|-------|--------|------|--------------|-------------|-------------------|
| `webhooks.json` | 4.1 MB | 3.7 MB | 1.6 MB | 188 KB | 1.4 MB | 84 KB | 68 KB |
| `objects.json` | 666 KB | N/A | 325 KB | 36 KB | 325 KB | 22 KB | 22 KB |
| **Total** | **4.78 MB** | - | **1.95 MB** | **224 KB** | **1.77 MB** | **106 KB** | **91 KB** |

**Stripping removes:** `summary`, `availability`, `category`, `action` fields from webhooks.json (unused by language service)

## workflow-v1.0.json (hand-authored schema)

| File | Original | Minify | Gzip | Minify+Gzip |
|------|----------|--------|------|-------------|
| `workflow-v1.0.json` | 91 KB | 69 KB | 13 KB | 12 KB |

**Note:** No stripping applicable - this is a hand-authored schema where all fields are used.

## Recommended Action

**For webhooks.json and objects.json:** Strip + Minify

- Modify `languageservice/script/webhooks/index.ts` to:
  1. Strip unused fields (`summary`, `availability`, `category`, `action`) before writing
  2. Use `JSON.stringify(obj)` instead of `JSON.stringify(obj, null, 2)` to minify

- Gzip is handled automatically by github-ui's production server

**For workflow-v1.0.json:** Minify at build time

- Add a build step to minify the JSON before publishing

**Expected savings:**
- npm package size: 4.78 MB → 1.77 MB (63% reduction)
- Network transfer (gzip): 224 KB → 91 KB (59% reduction)
