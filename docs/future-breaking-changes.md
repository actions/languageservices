# Future Breaking Changes

This document tracks cleanup changes we want to make in a future major version bump. These are architectural improvements that would break existing import paths or APIs.

**Current version:** 0.x (pre-1.0)

---

## `@actions/workflow-parser`

### Move shared utilities from `workflows/` to `templates/`

Several files in `workflows/` are actually generic and should live in `templates/`:

| File | Current Location | Proposed Location | Notes |
|------|------------------|-------------------|-------|
| `yaml-object-reader.ts` | `workflows/` | `templates/` | Generic YAML parsing, no workflow dependencies |
| `file.ts` | `workflows/` | `templates/` | Generic `{ name, content }` interface |
| `file-provider.ts` | `workflows/` | `templates/` | Generic interface |

**Impact:** Import paths change for consumers using deep imports.

### Consolidate export strategy

Currently:
- `index.ts` exports the "public API" 
- `package.json` has `"./*"` allowing deep imports to anything

Consider:
- Explicitly define which subpaths are stable API
- Document internal vs public paths
- Or: export everything needed from `index.ts` subpath exports

---

## `@actions/languageservice`

### Rename `action.ts` for clarity

`languageservice/src/action.ts` contains types for **consuming** actions (validating `uses:` in workflows). The name is ambiguous now that we have action.yml **authoring** support.

Consider renaming to:
- `action-metadata.ts` — clearer that it's about fetched metadata
- `action-consumer.ts` — clearer about the use case

---

## Notes

- Add items here as we discover them during development
- Group by package
- Include impact assessment for each change
