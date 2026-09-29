/**
 * Test validation behavior when no context providers are configured.
 *
 * When contextProviderConfig is not provided (or returns incomplete data),
 * we should skip validation for secrets/vars rather than showing false
 * positive "Context access might be invalid" warnings.
 *
 * This is important for offline/disconnected scenarios where API calls
 * to fetch secrets/vars are not possible.
 */

import {validate} from "./validate.js";
import {createDocument} from "./test-utils/document.js";
import {clearCache} from "./utils/workflow-cache.js";

beforeEach(() => {
  clearCache();
});

describe("validation without context providers", () => {
  describe("secrets context", () => {
    it("should not warn on secrets.GITHUB_TOKEN", async () => {
      const doc = createDocument(
        "wf.yaml",
        `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "test"
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`
      );
      const result = await validate(doc);
      expect(result).toEqual([]);
    });

    it("should not warn on custom secrets when no provider configured", async () => {
      const doc = createDocument(
        "wf.yaml",
        `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "test"
        env:
          API_KEY: \${{ secrets.MY_API_KEY }}
`
      );
      const result = await validate(doc);
      expect(result).toEqual([]);
    });

    it("should not warn on secrets with environment", async () => {
      const doc = createDocument(
        "wf.yaml",
        `
on: push
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: echo "test"
        env:
          API_KEY: \${{ secrets.API_KEY }}
`
      );
      const result = await validate(doc);
      expect(result).toEqual([]);
    });
  });

  describe("vars context", () => {
    it("should not warn on vars when no provider configured", async () => {
      const doc = createDocument(
        "wf.yaml",
        `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "\${{ vars.ENVIRONMENT }}"
`
      );
      const result = await validate(doc);
      expect(result).toEqual([]);
    });

    it("should not warn on vars with environment", async () => {
      const doc = createDocument(
        "wf.yaml",
        `
on: push
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: echo "\${{ vars.API_URL }}"
`
      );
      const result = await validate(doc);
      expect(result).toEqual([]);
    });

    it("should not warn on vars with fallback pattern", async () => {
      const doc = createDocument(
        "wf.yaml",
        `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo "\${{ vars.OPTIONAL_VAR || 'default-value' }}"
`
      );
      const result = await validate(doc);
      expect(result).toEqual([]);
    });
  });

  describe("combined secrets and vars", () => {
    it("should not warn on workflow using both secrets and vars", async () => {
      const doc = createDocument(
        "wf.yaml",
        `
on: push
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: |
          echo "Deploying to \${{ vars.API_URL }}"
          echo "Using region \${{ vars.AWS_REGION }}"
        env:
          API_KEY: \${{ secrets.API_KEY }}
          AWS_SECRET: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
`
      );
      const result = await validate(doc);
      expect(result).toEqual([]);
    });
  });
});
