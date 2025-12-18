import {DiagnosticSeverity} from "vscode-languageserver-types";
import {validate} from "./validate.js";
import {createDocument} from "./test-utils/document.js";
import {clearCache} from "./utils/workflow-cache.js";

beforeEach(() => {
  clearCache();
});

describe("validate concurrency deadlock", () => {
  describe("should error on matching concurrency groups", () => {
    it("simple string match", async () => {
      const input = `
on: push
concurrency: test
jobs:
  job1:
    runs-on: ubuntu-latest
    concurrency: test
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input));

      const concurrencyErrors = result.filter(d => d.message.includes("deadlock"));
      expect(concurrencyErrors).toHaveLength(2);

      // Workflow-level warning
      expect(concurrencyErrors[0]).toMatchObject({
        message: "Concurrency group 'test' is also used by job 'job1'. This will cause a deadlock.",
        severity: DiagnosticSeverity.Error
      });

      // Job-level warning
      expect(concurrencyErrors[1]).toMatchObject({
        message: "Concurrency group 'test' is also defined at the workflow level. This will cause a deadlock.",
        severity: DiagnosticSeverity.Error
      });
    });

    it("workflow mapping form, job string form", async () => {
      const input = `
on: push
concurrency:
  group: my-group
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    concurrency: my-group
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input));

      const concurrencyErrors = result.filter(d => d.message.includes("deadlock"));
      expect(concurrencyErrors).toHaveLength(2);
      expect(concurrencyErrors[0].message).toContain("my-group");
      expect(concurrencyErrors[0].message).toContain("deploy");
    });

    it("workflow string form, job mapping form", async () => {
      const input = `
on: push
concurrency: deploy-group
jobs:
  build:
    runs-on: ubuntu-latest
    concurrency:
      group: deploy-group
      cancel-in-progress: true
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input));

      const concurrencyErrors = result.filter(d => d.message.includes("deadlock"));
      expect(concurrencyErrors).toHaveLength(2);
      expect(concurrencyErrors[0].message).toContain("deploy-group");
    });

    it("both mapping forms", async () => {
      const input = `
on: push
concurrency:
  group: shared
jobs:
  job1:
    runs-on: ubuntu-latest
    concurrency:
      group: shared
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input));

      const concurrencyErrors = result.filter(d => d.message.includes("deadlock"));
      expect(concurrencyErrors).toHaveLength(2);
    });

    it("multiple jobs with matching concurrency", async () => {
      const input = `
on: push
concurrency: shared
jobs:
  job1:
    runs-on: ubuntu-latest
    concurrency: shared
    steps:
      - run: echo hi
  job2:
    runs-on: ubuntu-latest
    concurrency: shared
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input));

      // Should have 2 warnings per job (workflow + job) = 4 total, but workflow is only warned once per match
      // Actually: 1 workflow warning per matching job + 1 job warning per matching job = 4 total
      const concurrencyErrors = result.filter(d => d.message.includes("deadlock"));
      expect(concurrencyErrors).toHaveLength(4);
    });
  });

  describe("should not warn", () => {
    it("different concurrency groups", async () => {
      const input = `
on: push
concurrency: workflow-group
jobs:
  job1:
    runs-on: ubuntu-latest
    concurrency: job-group
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input));

      const concurrencyErrors = result.filter(d => d.message.includes("deadlock"));
      expect(concurrencyErrors).toHaveLength(0);
    });

    it("workflow concurrency is an expression", async () => {
      const input = `
on: push
concurrency: \${{ github.ref }}
jobs:
  job1:
    runs-on: ubuntu-latest
    concurrency: test
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input));

      const concurrencyErrors = result.filter(d => d.message.includes("deadlock"));
      expect(concurrencyErrors).toHaveLength(0);
    });

    it("job concurrency is an expression", async () => {
      const input = `
on: push
concurrency: test
jobs:
  job1:
    runs-on: ubuntu-latest
    concurrency: \${{ github.ref }}
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input));

      const concurrencyErrors = result.filter(d => d.message.includes("deadlock"));
      expect(concurrencyErrors).toHaveLength(0);
    });

    it("no workflow-level concurrency", async () => {
      const input = `
on: push
jobs:
  job1:
    runs-on: ubuntu-latest
    concurrency: test
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input));

      const concurrencyErrors = result.filter(d => d.message.includes("deadlock"));
      expect(concurrencyErrors).toHaveLength(0);
    });

    it("no job-level concurrency", async () => {
      const input = `
on: push
concurrency: test
jobs:
  job1:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input));

      const concurrencyErrors = result.filter(d => d.message.includes("deadlock"));
      expect(concurrencyErrors).toHaveLength(0);
    });

    it("case sensitive - different case is different group", async () => {
      const input = `
on: push
concurrency: Test
jobs:
  job1:
    runs-on: ubuntu-latest
    concurrency: test
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input));

      const concurrencyErrors = result.filter(d => d.message.includes("deadlock"));
      expect(concurrencyErrors).toHaveLength(0);
    });

    it("workflow concurrency group in mapping is an expression", async () => {
      const input = `
on: push
concurrency:
  group: \${{ github.ref }}
jobs:
  job1:
    runs-on: ubuntu-latest
    concurrency: test
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input));

      const concurrencyErrors = result.filter(d => d.message.includes("deadlock"));
      expect(concurrencyErrors).toHaveLength(0);
    });
  });
});
