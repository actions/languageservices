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
- **BUG:** See "Known Issues" section below

### Option B: Manual `.js` Extensions

Use `.js` extensions in source TypeScript files:

```typescript
import { Expr } from "./ast.js";  // Points to .ts file, but use .js extension
```

**Pros:**
- Works with TypeScript 4.7+ (with node16 moduleResolution)
- Well-established pattern
- No post-processing needed

**Cons:**
- Confusing - `.js` files don't exist at write time
- Doesn't work with Deno out of the box

### Recommendation

**Use Option A** with workarounds for known issues (see below).

---

## Known Issues and Workarounds (December 2025)

### 1. TypeScript Version Conflicts in Monorepo

**Problem:** The root `node_modules/typescript` was version 4.9.5 (pulled in by `ts-node` and `tsutils` dependencies), while workspace packages specified `^5.8.3`.

**Symptoms:** 
- `npx tsc --version` showed 4.9.5
- `require('typescript').version` in ts-jest showed 5.8.3
- Confusing build failures

**Solution:** Add npm overrides in root `package.json`:
```json
{
  "overrides": {
    "typescript": "5.8.3"
  }
}
```

### 2. ts-jest Compatibility with TypeScript 5.9+

**Problem:** ts-jest 29.4.6 uses `typescript.JSDocParsingMode.ParseAll` which doesn't exist in TypeScript's ES module exports.

**Error:**
```
TypeError: Cannot read properties of undefined (reading 'ParseAll')
at Object.<anonymous> (node_modules/ts-jest/dist/compiler/ts-compiler.js:43:123)
```

**Root Cause:** ts-jest accesses `typescript_1.default.JSDocParsingMode.ParseAll` but TypeScript has no default export in ESM.

**Solution:** 
- Use ts-jest 29.0.3 (older version that doesn't use this API)
- OR wait for ts-jest fix
- **Stay on TypeScript 5.8.3, not 5.9+**

### 3. TypeScript `rewriteRelativeImportExtensions` Bug with .d.ts Files

**Problem:** TypeScript's `rewriteRelativeImportExtensions: true` correctly rewrites `.ts` → `.js` in `.js` output files, but **incorrectly keeps `.ts` extensions in `.d.ts` declaration files**.

**Example:**
- Source: `export { Expr } from "./ast.ts";`
- Output `index.js`: `export { Expr } from "./ast.js";` ✅ Correct
- Output `index.d.ts`: `export { Expr } from "./ast.ts";` ❌ Wrong (should be `.js`)

**Upstream Issue:** https://github.com/microsoft/TypeScript/issues/61037 (marked "Help Wanted", in Backlog, NOT FIXED as of Dec 2025)

**Workaround:** Post-process `.d.ts` files with a script. Create `script/fix-dts-extensions.cjs`:

```javascript
#!/usr/bin/env node
/**
 * Post-build script to fix TypeScript's rewriteRelativeImportExtensions bug
 * where .d.ts files get .ts extensions instead of .js extensions.
 * See: https://github.com/microsoft/TypeScript/issues/61037
 */

const fs = require('fs');
const path = require('path');

function fixDtsFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    // Replace .ts extensions in import/export statements with .js
    content = content.replace(/(from\s+["'])([^"']+)\.ts(["'])/g, '$1$2.js$3');
    content = content.replace(/(import\s*\(\s*["'])([^"']+)\.ts(["']\s*\))/g, '$1$2.js$3');
    content = content.replace(/(export\s+\*\s+from\s+["'])([^"']+)\.ts(["'])/g, '$1$2.js$3');
    
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed: ${filePath}`);
        return true;
    }
    return false;
}

function walkDir(dir, callback) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walkDir(filePath, callback);
        } else if (file.endsWith('.d.ts')) {
            callback(filePath);
        }
    }
}

function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: fix-dts-extensions.cjs <dist-dir> [<dist-dir2> ...]');
        process.exit(1);
    }
    
    let fixedCount = 0;
    for (const dir of args) {
        if (!fs.existsSync(dir)) {
            console.warn(`Directory not found: ${dir}`);
            continue;
        }
        walkDir(dir, (filePath) => {
            if (fixDtsFile(filePath)) {
                fixedCount++;
            }
        });
    }
    console.log(`Fixed ${fixedCount} .d.ts file(s)`);
}

main();
```

**Note:** Use `.cjs` extension since root `package.json` has `"type": "module"`.

**Usage in package.json build scripts:**
```json
{
  "scripts": {
    "build": "tsc --build tsconfig.build.json && node ../script/fix-dts-extensions.cjs dist"
  }
}
```

### 4. languageserver Tests Hang

**Problem:** The languageserver tests hang indefinitely when running with the ESM configuration.

**Status:** Not fully diagnosed. Tests pass on main branch but hang on ESM branch.

**Possible causes:**
- Jest ESM module resolution issues
- Cross-package source mappings in jest.config.js
- vscode-languageserver ESM compatibility issues
- Specific test file causing hang (needs isolation testing)

**Investigation needed:**
- Run individual test files to isolate the hanging test
- Check if vscode-languageserver has ESM compatibility issues
- Review jest configuration for problematic mappings
- Try running with `--detectOpenHandles` flag

---

## Required Configuration Changes

### tsconfig.json (each package)

```json
{
  "compilerOptions": {
    "module": "node16",
    "moduleResolution": "node16",
    "rewriteRelativeImportExtensions": true,
    "lib": ["ES2022"],
    "target": "ES2022"
  }
}
```

### jest.config.js (each package)

```javascript
/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: "ts-jest/presets/default-esm",
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^(\\.{1,2}/.*)\\.ts$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        isolatedModules: true,
      },
    ],
  },
  moduleFileExtensions: ["ts", "js"],
};
```

### Root package.json

```json
{
  "overrides": {
    "typescript": "5.8.3"
  }
}
```

### Each workspace package.json

```json
{
  "devDependencies": {
    "typescript": "^5.8.3",
    "ts-jest": "^29.0.3"
  }
}
```

---

## Test Results (December 2025 Attempt)

| Package | Tests | Status |
|---------|-------|--------|
| expressions | 1068 | ✅ Pass |
| workflow-parser | 292 | ✅ Pass |
| languageservice | 452 | ✅ Pass |
| languageserver | 6 files | ❌ Hangs (needs investigation) |

---

## Implementation Steps

### Phase 1: Prerequisites
- [ ] Merge all pending PRs to avoid conflicts
- [ ] Ensure clean main branch state

### Phase 2: TypeScript & Dependencies
- [ ] Add `"overrides": { "typescript": "5.8.3" }` to root package.json
- [ ] Update all workspace packages to TypeScript ^5.8.3
- [ ] Downgrade ts-jest to ^29.0.3 in all packages
- [ ] Run `npm install` to apply changes

### Phase 3: tsconfig Updates
- [ ] Update tsconfig.json in each package with node16 settings
- [ ] Add `rewriteRelativeImportExtensions: true`

### Phase 4: Add .ts Extensions to Imports
- [ ] Update all relative imports in source files to use `.ts` extensions
- [ ] This was already done in PR #243

### Phase 5: Create Fix Script
- [ ] Add `script/fix-dts-extensions.cjs` to repository
- [ ] Update build scripts to run fix after tsc

### Phase 6: Fix languageserver Tests
- [ ] Investigate why tests hang
- [ ] Isolate problematic test file
- [ ] Apply fix or workaround

### Phase 7: Verification
- [ ] Run `npm run build` in all packages
- [ ] Run `npm test` in all packages
- [ ] Test importing published packages in Node.js ESM mode
- [ ] Verify browser-playground still works

### Phase 8: CI Updates
- [ ] Update GitHub Actions workflows if needed
- [ ] Ensure fix-dts-extensions.cjs runs in CI

---

## Summary of Required Changes

1. **Root package.json**: Add TypeScript override
2. **All packages**: TypeScript 5.8.3, ts-jest 29.0.3
3. **All tsconfigs**: node16 moduleResolution, rewriteRelativeImportExtensions
4. **All imports**: Add .ts extensions (already done)
5. **Build scripts**: Add post-build .d.ts fix
6. **languageserver**: Debug test hang issue

---

## References

- [TypeScript moduleResolution reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html)
- [TypeScript 5.7 rewriteRelativeImportExtensions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-7.html#path-rewriting-for-relative-paths)
- [TypeScript .d.ts extension bug #61037](https://github.com/microsoft/TypeScript/issues/61037)
- [Node.js ESM mandatory extensions](https://nodejs.org/api/esm.html#mandatory-file-extensions)
- [ts-jest ESM support](https://kulshekhar.github.io/ts-jest/docs/guides/esm-support)
- [Community fork that works](https://github.com/boxbuild-io/actions-languageservices/commit/077fb2b58dfd2cca3d6e3df1fdf9e26e75db24ae)
