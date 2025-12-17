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
- Works with ts-jest without extra configuration

**Cons:**
- Confusing - `.js` files don't exist at write time
- Doesn't work with Deno out of the box

### Recommendation

**Use Option B** (manual `.js` extensions). Option A with `rewriteRelativeImportExtensions` has compatibility issues with ts-jest and requires additional workarounds.

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

**Workaround:** Post-process `.d.ts` files with a script. See `script/fix-dts-extensions.cjs`.

### 4. languageserver Tests Hang

**Problem:** The languageserver tests hang indefinitely when running with the ESM configuration.

**Status:** Not fully diagnosed. Tests pass on main branch but hang on ESM branch.

**Possible causes:**
- Jest ESM module resolution issues
- Cross-package source mappings in jest.config.js
- vscode-languageserver ESM compatibility issues
- Specific test file causing hang (needs isolation testing)

**Current Decision:** The languageserver package is **deferred** from this migration until the test hang issue is resolved. It will continue using the old configuration.

**Investigation needed:**
- Run individual test files to isolate the hanging test
- Check if vscode-languageserver has ESM compatibility issues
- Review jest configuration for problematic mappings
- Try running with `--detectOpenHandles` flag

---

## Migration Status

| Package | Tests | ESM Status |
|---------|-------|------------|
| expressions | 1068 | ✅ Migrated |
| workflow-parser | 292 | ✅ Migrated |
| languageservice | 452 | ✅ Migrated |
| languageserver | 6 files | ⏸️ Deferred (test hang) |

---

## Required Configuration Changes

### tsconfig.json (each migrated package)

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

### jest.config.js (each migrated package)

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

## References

- [TypeScript moduleResolution reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html)
- [TypeScript 5.7 rewriteRelativeImportExtensions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-7.html#path-rewriting-for-relative-paths)
- [TypeScript .d.ts extension bug #61037](https://github.com/microsoft/TypeScript/issues/61037)
- [Node.js ESM mandatory extensions](https://nodejs.org/api/esm.html#mandatory-file-extensions)
- [ts-jest ESM support](https://kulshekhar.github.io/ts-jest/docs/guides/esm-support)
- [Community fork that works](https://github.com/boxbuild-io/actions-languageservices/commit/077fb2b58dfd2cca3d6e3df1fdf9e26e75db24ae)
