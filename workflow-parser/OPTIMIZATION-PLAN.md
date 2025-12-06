# Workflow Schema Optimization Plan

## Current State (Commit 7660f61)

### What's Implemented

1. **Original schema preserved**: `workflow-v1.0.json` remains source of truth with 291 definitions
2. **Optimization script**: `script/optimize-workflow-schema.js` prunes unused definitions
3. **Generated files** (gitignored):
   - `workflow-v1.0.optimized.json` - 281 definitions (pruned)
   - `workflow-v1.0.optimized.min.json` - minified version loaded at runtime
4. **Build pipeline**: `npm run minify-json` chains optimize → minify
5. **Tests**: `workflow-schema.test.ts` validates schema integrity

### 10 Pruned Definitions

These are unreachable from `workflow-root-strict` entry point:

- `workflow-root` (non-strict variant)
- `on` (non-strict variant)
- `on-mapping` (non-strict variant)
- `job-if-result`
- `step-if-result`
- `boolean-needs-context`
- `number-needs-context`
- `string-needs-context`
- `boolean-steps-context`
- `number-steps-context`

### Size Savings

| Metric | Original | Optimized | Savings |
|--------|----------|-----------|---------|
| Definitions | 291 | 281 | 10 removed |
| Minified | 71,061 B | 69,022 B | 2.9% |
| Gzipped | 12,318 B | 12,172 B | 1.2% |

## Optimization Strategies Evaluated

### ✅ Pruning Unused Definitions (IMPLEMENTED)
- Removes definitions not reachable from entry point
- 1.2% gzip savings
- Low complexity, no runtime overhead

### ❌ Key Shortening
- Replace long keys with short codes (e.g., `description` → `d`)
- 1.5% gzip savings
- NOT WORTH IT: Adds complexity, minimal benefit after gzip

### ❌ String Interning
- Deduplicate repeated strings into lookup table
- Makes gzip WORSE (-0.5%)
- NOT WORTH IT: Gzip already handles repetition

### ❌ Compact Format (like webhooks)
- Restructure to array-based format
- Makes gzip WORSE (-0.4%)
- NOT WORTH IT: Schema structure doesn't benefit

### ❌ Split Descriptions
- Separate file for descriptions
- Adds 791 bytes when both files gzipped
- NOT WORTH IT: Worse total size

## Future Work

### Update from Server
The current schema may be missing some definitions from the latest server version. A future PR should:
1. Fetch latest `workflow-v1.0.json` from dotcom server
2. Update the source file
3. Verify tests still pass
4. Note: Server version had issues last checked (e.g., `coerce-raw`, missing `branches` on merge-group)

### Entry Point
- Entry point: `workflow-root-strict` (defined in `workflow-constants.ts`)
- Non-strict `workflow-root` exists but is unused in this codebase

## Files

```
workflow-parser/
├── src/
│   ├── workflow-v1.0.json              # Source of truth (tracked, 291 defs)
│   ├── workflow-v1.0.optimized.json    # Pruned (gitignored, 281 defs)
│   ├── workflow-v1.0.optimized.min.json # Minified (gitignored)
│   └── workflows/
│       ├── workflow-schema.ts          # Loader (imports optimized.min.json)
│       └── workflow-schema.test.ts     # Schema integrity tests
└── script/
    └── optimize-workflow-schema.js     # Pruning script
```

## Test Coverage

- `workflow-schema.test.ts`:
  1. Schema loads from workflow-root-strict
  2. All referenced definitions are reachable
  3. Critical definitions exist (jobs, steps, runs-on, etc.)
