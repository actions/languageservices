import {registerLogger} from "./log.js";
import {createDocument} from "./test-utils/document.js";
import {TestLogger} from "./test-utils/logger.js";
import {clearCache} from "./utils/workflow-cache.js";
import {validate} from "./validate.js";

registerLogger(new TestLogger());

beforeEach(() => {
  clearCache();
});

describe("service container command/entrypoint", () => {
  it("allows command in service container", async () => {
    const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis
        command: --port 6380
    steps:
      - run: echo hi
`;
    const result = await validate(createDocument("wf.yaml", input));
    const commandErrors = result.filter(d => d.message.includes("command"));
    expect(commandErrors).toEqual([]);
  });

  it("allows entrypoint in service container", async () => {
    const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis
        entrypoint: /usr/local/bin/redis-server
    steps:
      - run: echo hi
`;
    const result = await validate(createDocument("wf.yaml", input));
    const entrypointErrors = result.filter(d => d.message.includes("entrypoint"));
    expect(entrypointErrors).toEqual([]);
  });

  it("allows both command and entrypoint in service container", async () => {
    const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis
        entrypoint: /usr/local/bin/redis-server
        command: --port 6380
    steps:
      - run: echo hi
`;
    const result = await validate(createDocument("wf.yaml", input));
    const relevantErrors = result.filter(d => d.message.includes("command") || d.message.includes("entrypoint"));
    expect(relevantErrors).toEqual([]);
  });

  it("rejects command in job container", async () => {
    const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    container:
      image: node:20
      command: node
    steps:
      - run: echo hi
`;
    const result = await validate(createDocument("wf.yaml", input));
    const commandErrors = result.filter(d => d.message.includes("command"));
    expect(commandErrors.length).toBeGreaterThan(0);
  });

  it("rejects entrypoint in job container", async () => {
    const input = `
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    container:
      image: node:20
      entrypoint: /bin/bash
    steps:
      - run: echo hi
`;
    const result = await validate(createDocument("wf.yaml", input));
    const entrypointErrors = result.filter(d => d.message.includes("entrypoint"));
    expect(entrypointErrors.length).toBeGreaterThan(0);
  });
});
