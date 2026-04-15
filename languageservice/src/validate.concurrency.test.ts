import {FeatureFlags} from "@actions/expressions/features";
import {DiagnosticSeverity} from "vscode-languageserver-types";
import {validate} from "./validate.js";
import {createDocument} from "./test-utils/document.js";
import {clearCache} from "./utils/workflow-cache.js";

beforeEach(() => {
  clearCache();
});

const queueValidationConfig = {
  featureFlags: new FeatureFlags({allowConcurrencyQueue: true})
};

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

describe("validate concurrency queue + cancel-in-progress conflict", () => {
  describe("should error", () => {
    it("workflow-level queue: max with cancel-in-progress: true", async () => {
      const input = `
on: push
concurrency:
  group: deploy
  cancel-in-progress: true
  queue: max
jobs:
  job1:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input), queueValidationConfig);

      const queueErrors = result.filter(d => d.message.includes("queue: max"));
      expect(queueErrors).toHaveLength(1);
      expect(queueErrors[0]).toMatchObject({
        message: "'queue: max' cannot be combined with 'cancel-in-progress: true'.",
        severity: DiagnosticSeverity.Error
      });
    });

    it("job-level queue: max with cancel-in-progress: true", async () => {
      const input = `
on: push
jobs:
  job1:
    runs-on: ubuntu-latest
    concurrency:
      group: deploy
      cancel-in-progress: true
      queue: max
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input), queueValidationConfig);

      const queueErrors = result.filter(d => d.message.includes("queue: max"));
      expect(queueErrors).toHaveLength(1);
      expect(queueErrors[0]).toMatchObject({
        severity: DiagnosticSeverity.Error
      });
    });

    it("both workflow and job level have the conflict", async () => {
      const input = `
on: push
concurrency:
  group: deploy
  cancel-in-progress: true
  queue: max
jobs:
  job1:
    runs-on: ubuntu-latest
    concurrency:
      group: build
      cancel-in-progress: true
      queue: max
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input), queueValidationConfig);

      const queueErrors = result.filter(d => d.message.includes("queue: max"));
      expect(queueErrors).toHaveLength(2);
    });
  });

  describe("should not error", () => {
    it("queue: max without cancel-in-progress", async () => {
      const input = `
on: push
concurrency:
  group: deploy
  queue: max
jobs:
  job1:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input));

      const queueErrors = result.filter(d => d.message.includes("queue: max"));
      expect(queueErrors).toHaveLength(0);
    });

    it("queue: single with cancel-in-progress: true", async () => {
      const input = `
on: push
concurrency:
  group: deploy
  cancel-in-progress: true
  queue: single
jobs:
  job1:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input));

      const queueErrors = result.filter(d => d.message.includes("queue: max"));
      expect(queueErrors).toHaveLength(0);
    });

    it("cancel-in-progress: false with queue: max", async () => {
      const input = `
on: push
concurrency:
  group: deploy
  cancel-in-progress: false
  queue: max
jobs:
  job1:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input));

      const queueErrors = result.filter(d => d.message.includes("queue: max"));
      expect(queueErrors).toHaveLength(0);
    });

    it("no queue property", async () => {
      const input = `
on: push
concurrency:
  group: deploy
  cancel-in-progress: true
jobs:
  job1:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input));

      const queueErrors = result.filter(d => d.message.includes("queue: max"));
      expect(queueErrors).toHaveLength(0);
    });

    it("string form concurrency (no mapping)", async () => {
      const input = `
on: push
concurrency: deploy
jobs:
  job1:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input));

      const queueErrors = result.filter(d => d.message.includes("queue: max"));
      expect(queueErrors).toHaveLength(0);
    });

    it("does not report queue conflict when the feature is disabled", async () => {
      const input = `
on: push
concurrency:
  group: deploy
  cancel-in-progress: true
  queue: max
jobs:
  job1:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi`;

      const result = await validate(createDocument("wf.yaml", input));

      const queueConflictErrors = result.filter(d => d.message.includes("queue: max"));
      expect(queueConflictErrors).toHaveLength(0);
    });
  });
});
