# Agents

## Build

```
npx lerna run build
```

## Test

```
npm -w @actions/expressions test
npm -w @actions/workflow-parser test
npm -w @actions/languageservice test
```

## Format

Always run formatting before committing:

```
npx prettier --write <changed files>
```

Verify with:

```
npm run format-check -ws
```

## Feature flags

Feature flags are defined in `expressions/src/features.ts` (`ExperimentalFeatures` interface + `allFeatureKeys` array). They are plumbed through `ConvertOptions`, `CompletionConfig`, `ValidationConfig`, and `initializationOptions`. When a feature graduates to stable, remove its flag and make the behavior unconditional.
