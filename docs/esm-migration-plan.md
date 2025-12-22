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

**Note:** Since we use Option B (manual `.js` extensions), this bug does not affect our migration.

### 4. yaml Package Internal Types Not Exported

**Problem:** The `yaml` package does not export internal types like `LinePos` and `NodeBase` that are used in `workflow-parser/src/workflows/yaml-object-reader.ts`.

**Error:**
```
error TS2305: Module '"yaml"' has no exported member 'LinePos'.
error TS2305: Module '"yaml"' has no exported member 'NodeBase'.
```

**Solution:** Define local type aliases in the file that uses them:
```typescript
// Local type definitions to replace yaml internal imports
type LinePos = { line: number; col: number };
type NodeBase = { range?: [number, number, number] };
```

### 5. languageserver Blocked by vscode-languageserver Dependency

**Problem:** The `vscode-languageserver` package (v8.0.2) does not have proper ESM exports. When using `moduleResolution: "node16"`, TypeScript requires packages to have an `exports` field in `package.json` for subpath imports to work.

**Error:**
```
src/index.ts(6,8): error TS2307: Cannot find module 'vscode-languageserver/browser' or its corresponding type declarations.
src/connection.ts(1,43): error TS2307: Cannot find module 'vscode-languageserver/node' or its corresponding type declarations.
```

**Root Cause:** The `vscode-languageserver` package.json only has `main` and `browser` fields, but no `exports` field:
```json
{
  "main": "./lib/node/main.js",
  "browser": {
    "./lib/node/main.js": "./lib/browser/main.js"
  }
  // No "exports" field!
}
```

With `moduleResolution: "node16"`, TypeScript follows Node.js ESM resolution rules which require explicit `exports` for subpath imports like `vscode-languageserver/browser` and `vscode-languageserver/node`.

**Status:** Verified December 2025. Version 9.0.1 is available but ESM export support is not confirmed.

**Current Decision:** The languageserver package is **deferred** from this migration until the upstream `vscode-languageserver` package adds proper ESM exports. It will continue using the old `moduleResolution: "node"` configuration.

**Options to resolve:**
- Wait for vscode-languageserver to add ESM exports
- Try upgrading to vscode-languageserver v9.x to see if exports were added
- Use a bundler to work around the module resolution
- Fork or patch the dependency

---

## Migration Status

| Package | Tests | ESM Status |
|---------|-------|------------|
| expressions | 1068 | ✅ Migrated |
| workflow-parser | 292 | ✅ Migrated |
| languageservice | 452 | ✅ Migrated |
| languageserver | 6 files | ⏸️ Deferred (vscode-languageserver lacks ESM exports) |

---

## Required Configuration Changes

### tsconfig.build.json (each migrated package)

**Note:** We use **Option B** (manual `.js` extensions in source files) rather than `rewriteRelativeImportExtensions` because Option A caused ts-jest compatibility issues (tests would hang indefinitely).

```json
{
  "compilerOptions": {
    "module": "node16",
    "moduleResolution": "node16",
    "skipLibCheck": true,
    "lib": ["ES2022"],
    "target": "ES2022"
  }
}
```

The `skipLibCheck: true` is needed to work around @types/node compatibility issues with TypeScript 5.x (TS2386 overload signature errors).
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
