# ESM Migration Plan: Add File Extensions to Imports

## Overview

This document outlines the plan to migrate from TypeScript's deprecated `"moduleResolution": "node"` (node10) to `"moduleResolution": "node16"` or `"nodenext"`. This change is necessary because the published ESM packages have extensionless imports that don't work correctly in modern ESM environments.

## Issues Fixed

This migration will resolve the following issues:

- **#154** - Upgrade `moduleResolution` from `node` to `node16` or `nodenext` in tsconfig
- **#110** - Published ESM code has imports without file extensions
- **#64** - expressions: ERR_MODULE_NOT_FOUND attempting to run example demo script  
- **#146** - Can not import `@actions/workflow-parser`

## Problem Statement

### Current State

All packages use `"moduleResolution": "node"`:

| Package | moduleResolution | TypeScript |
|---------|------------------|------------|
| expressions | `"node"` | ^4.7.4 |
| workflow-parser | `"node"` | ^4.8.4 |
| languageservice | `"node"` | ^4.8.4 |
| languageserver | `"node"` | ^4.8.4 |
| browser-playground | `"Node16"` ✅ | ^4.9.4 |

This causes TypeScript to emit code like:
```javascript
// Published to npm - INVALID ESM
export { Expr } from "./ast";  // Missing .js extension!
```

### Why This Fails

ESM in Node.js 12+ **requires** explicit file extensions. When users try to import these packages:

```javascript
// User's code
import { Expr } from "@actions/expressions";
```

Node.js fails with:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../node_modules/@actions/expressions/dist/ast'
```

## Migration Strategy

### Option A: TypeScript 5.7+ with `rewriteRelativeImportExtensions` (Recommended)

TypeScript 5.7 introduced a new compiler option that automatically rewrites `.ts` extensions to `.js` in output:

```jsonc
{
  "compilerOptions": {
    "moduleResolution": "node16",  // or "nodenext"
    "rewriteRelativeImportExtensions": true
  }
}
```

**Source code:**
```typescript
import { Expr } from "./ast.ts";
```

**Compiled output:**
```javascript
export { Expr } from "./ast.js";
```

**Pros:**
- Source uses `.ts` extensions (matches actual files)
- Works with Deno (which requires `.ts` extensions)
- TypeScript automatically transforms to `.js`
- Modern, forward-looking approach

**Cons:**
- Requires TypeScript 5.7+
- Relatively new feature

### Option B: Manual `.js` Extensions

Use `.js` extensions in source TypeScript files:

```typescript
import { Expr } from "./ast.js";  // Points to .ts file, but use .js extension
```

**Pros:**
- Works with TypeScript 4.7+ (with node16 moduleResolution)
- Well-established pattern

**Cons:**
- Confusing - `.js` files don't exist at write time
- Doesn't work with Deno out of the box

### Recommendation

**Use Option A** - TypeScript 5.7+ with `rewriteRelativeImportExtensions`:
- Cleaner developer experience (`.ts` imports match actual files)
- Better Deno compatibility
- TypeScript 5.x upgrade is already on the roadmap (see Dependabot PRs #208-212)

## Scope of Changes

### Statistics

- **~73 source files** need import updates
- **~176 relative imports** need `.ts` extensions added
- **5 packages** need tsconfig updates (browser-playground already uses node16)
- **6 JSON imports** need attention

### Package-by-Package Breakdown

#### expressions/
- tsconfig.json: Update `moduleResolution`
- Add `.ts` extensions to all relative imports
- Files: ~15 source files

#### workflow-parser/
- tsconfig.json: Update `moduleResolution`
- Add `.ts` extensions to all relative imports
- JSON import: `workflow-v1.0.min.json` - needs `with { type: "json" }` or type assertion
- Files: ~25 source files

#### languageservice/
- tsconfig.json: Update `moduleResolution`
- Add `.ts` extensions to all relative imports
- JSON imports: webhooks, schedule, workflow_call, descriptions - need handling
- Files: ~30 source files

#### languageserver/
- tsconfig.json: Update `moduleResolution`
- Add `.ts` extensions to all relative imports
- Files: ~10 source files

#### browser-playground/
- Already uses `"moduleResolution": "Node16"` ✅
- May need import extension updates
- Bundled via webpack, so may have different requirements

### JSON Import Handling

JSON imports require special handling in node16/nodenext. Options:

1. **Import Attributes (Node 20.10+)**
   ```typescript
   import schema from "./workflow-v1.0.json" with { type: "json" };
   ```
   Requires: TypeScript 5.3+, Node 20.10+

2. **fs.readFileSync at runtime**
   ```typescript
   const schema = JSON.parse(fs.readFileSync(new URL("./schema.json", import.meta.url), "utf8"));
   ```
   Works with any Node version but requires runtime file access

3. **Keep resolveJsonModule with assertion**
   ```typescript
   import schema from "./schema.json" assert { type: "json" };
   ```
   Note: `assert` is deprecated in favor of `with`

**Recommendation:** Use Import Attributes (`with { type: "json" }`) since we already require Node >= 18 and will bump TypeScript to 5.x.

## Implementation Steps

### Phase 1: Prerequisites (Wait for merge)

- [ ] Merge all pending PRs to avoid conflicts
  - PR #242 (activity types)
  - Any other pending PRs

### Phase 2: TypeScript Upgrade

- [ ] Upgrade TypeScript to 5.7+ in all packages
- [ ] Merge Dependabot PRs #208-212 or create unified upgrade PR
- [ ] Verify all tests pass after upgrade

### Phase 3: tsconfig Updates

Update each package's `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "module": "node16",           // or "nodenext"
    "moduleResolution": "node16", // or "nodenext" 
    "rewriteRelativeImportExtensions": true
  }
}
```

### Phase 4: Add Extensions to Imports

For each package, update all relative imports:

```typescript
// Before
import { Expr } from "./ast";
import { Parser } from "./parser";

// After  
import { Expr } from "./ast.ts";
import { Parser } from "./parser.ts";
```

**Automation approach:**
```bash
# Can use sed/perl or a codemod tool
find src -name "*.ts" -exec sed -i "s/from '\.\//from '.\\//g" {} \;
# More sophisticated regex needed - consider using ts-morph or jscodeshift
```

### Phase 5: JSON Import Updates

Update JSON imports to use import attributes:

```typescript
// Before
import schema from "./workflow-v1.0.min.json";

// After
import schema from "./workflow-v1.0.min.json" with { type: "json" };
```

### Phase 6: Verification

- [ ] Run `npm run build` in all packages
- [ ] Run `npm test` in all packages
- [ ] Test importing published packages in:
  - [ ] Node.js ESM mode (`"type": "module"`)
  - [ ] Vite project
  - [ ] Deno (bonus)
- [ ] Verify browser-playground still works

### Phase 7: Documentation

- [ ] Update READMEs with any new requirements
- [ ] Add migration notes to CHANGELOG

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking change for consumers | High | Semver major version bump |
| Import attributes not supported in older bundlers | Medium | Test with webpack, vite, rollup |
| Some edge cases with re-exports | Low | Careful testing |
| browser-playground uses webpack | Low | Webpack handles bundling differently |

## Timeline

1. **Wait for pending PRs** - ~1 week
2. **TypeScript upgrade** - 1 day
3. **Import migration** - 2-3 days
4. **Testing & verification** - 1 day
5. **Documentation** - 0.5 day

**Total: ~1-2 weeks** after dependencies are ready

## References

- [TypeScript moduleResolution reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html)
- [TypeScript 5.7 rewriteRelativeImportExtensions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-7.html#path-rewriting-for-relative-paths)
- [Node.js ESM mandatory extensions](https://nodejs.org/api/esm.html#mandatory-file-extensions)
- [Import Attributes proposal](https://github.com/tc39/proposal-import-attributes)
- [Community fork that works](https://github.com/boxbuild-io/actions-languageservices/commit/077fb2b58dfd2cca3d6e3df1fdf9e26e75db24ae)
