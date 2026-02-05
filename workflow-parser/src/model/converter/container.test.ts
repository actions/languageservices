/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {nullTrace} from "../../test-utils/null-trace.js";
import {parseWorkflow} from "../../workflows/workflow-parser.js";
import {convertWorkflowTemplate, ErrorPolicy} from "../convert.js";

async function getErrors(content: string): Promise<string[]> {
  const result = parseWorkflow({name: "wf.yaml", content}, nullTrace);
  const template = await convertWorkflowTemplate(result.context, result.value!, undefined, {
    errorPolicy: ErrorPolicy.TryConversion
  });
  return (template.errors ?? []).map((e: {Message: string}) => e.Message);
}

function expectNoContainerErrors(errors: string[]): void {
  const containerErrors = errors.filter(e => e.includes("Container image"));
  expect(containerErrors).toHaveLength(0);
}

function expectContainerError(errors: string[], count = 1): void {
  const containerErrors = errors.filter(e => e.includes("Container image cannot be empty"));
  expect(containerErrors).toHaveLength(count);
}

describe("container image validation", () => {
  describe("shorthand form", () => {
    it("container: '' is silent for job container", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    container: ''
    steps:
      - run: echo hi`);
      expectNoContainerErrors(errors);
    });

    it("container: docker:// errors", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    container: docker://
    steps:
      - run: echo hi`);
      expectContainerError(errors);
    });

    it("container: valid-image passes", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    container: ubuntu:16.04
    steps:
      - run: echo hi`);
      expectNoContainerErrors(errors);
    });
  });

  describe("mapping form", () => {
    it("container image: '' errors", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    container:
      image: ''
    steps:
      - run: echo hi`);
      expectContainerError(errors);
    });

    it("container image: docker:// errors", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    container:
      image: docker://
    steps:
      - run: echo hi`);
      expectContainerError(errors);
    });

    it("container: {} (empty object, missing image) errors", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    container: {}
    steps:
      - run: echo hi`);
      expectContainerError(errors);
    });

    it("container image: null errors", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    container:
      image:
    steps:
      - run: echo hi`);
      expectContainerError(errors);
    });

    it("empty image with expression in other field still errors", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    container:
      image: ''
      options: \${{ matrix.opts }}
    steps:
      - run: echo hi`);
      expectContainerError(errors);
    });
  });

  describe("services shorthand", () => {
    it("services svc: '' errors", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    services:
      svc: ''
    steps:
      - run: echo hi`);
      expectContainerError(errors);
    });

    it("services svc: docker:// errors", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    services:
      svc: docker://
    steps:
      - run: echo hi`);
      expectContainerError(errors);
    });
  });

  describe("services mapping", () => {
    it("services svc image: '' errors", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    services:
      svc:
        image: ''
    steps:
      - run: echo hi`);
      expectContainerError(errors);
    });

    it("services svc image: docker:// errors", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    services:
      svc:
        image: docker://
    steps:
      - run: echo hi`);
      expectContainerError(errors);
    });

    it("services svc: {} (empty object) errors", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    services:
      svc: {}
    steps:
      - run: echo hi`);
      expectContainerError(errors);
    });

    it("empty image with expression sibling service still errors", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    services:
      svc1:
        image: ''
      svc2: \${{ matrix.svc }}
    steps:
      - run: echo hi`);
      expectContainerError(errors);
    });
  });

  describe("expression safety", () => {
    it("container: expression skips validation", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    container: \${{ matrix.container }}
    steps:
      - run: echo hi`);
      expectNoContainerErrors(errors);
    });

    it("container image: expression skips validation", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    container:
      image: \${{ matrix.image }}
      options: --privileged
    steps:
      - run: echo hi`);
      expectNoContainerErrors(errors);
    });

    it("container with expression key skips validation", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    container:
      \${{ vars.KEY }}: ubuntu
    steps:
      - run: echo hi`);
      expectNoContainerErrors(errors);
    });

    it("services: expression skips validation", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    services: \${{ fromJSON(inputs.services) }}
    steps:
      - run: echo hi`);
      expectNoContainerErrors(errors);
    });

    it("services with expression alias key skips validation", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    services:
      \${{ matrix.alias }}: postgres
    steps:
      - run: echo hi`);
      expectNoContainerErrors(errors);
    });

    it("services container with expression key skips validation", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    services:
      db:
        \${{ vars.KEY }}: postgres
    steps:
      - run: echo hi`);
      expectNoContainerErrors(errors);
    });

    it("container with all expression fields skips validation", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    container:
      image: \${{ matrix.image }}
      options: \${{ matrix.options }}
    steps:
      - run: echo hi`);
      expectNoContainerErrors(errors);
    });

    it("services svc: expression skips validation", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    services:
      db: \${{ matrix.db }}
    steps:
      - run: echo hi`);
      expectNoContainerErrors(errors);
    });

    it("services image: expression skips validation", async () => {
      const errors = await getErrors(`on: push
jobs:
  build:
    runs-on: linux
    services:
      db:
        image: \${{ matrix.db_image }}
        options: --health-cmd pg_isready
    steps:
      - run: echo hi`);
      expectNoContainerErrors(errors);
    });
  });
});
