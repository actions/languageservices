/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion */
import {nullTrace} from "../../test-utils/null-trace.js";
import {parseWorkflow} from "../../workflows/workflow-parser.js";
import {MappingToken} from "./mapping-token.js";
import {SequenceToken} from "./sequence-token.js";
import {StringToken} from "./string-token.js";
import {TemplateToken} from "./template-token.js";

describe("traverse", () => {
  it("returns parent token, key, and ancestors", () => {
    const workflow = parseWorkflow(
      {
        name: "wf.yaml",
        content: `on: push`
      },
      nullTrace
    );

    const root = workflow.value!;
    const traverser = TemplateToken.traverse(root);

    // Root
    const rootResult = traverser.next()!.value!;
    expect(rootResult[0]).toBeUndefined();
    expect(rootResult[1]).toBe(root);
    expect(rootResult[2]).toBeUndefined();
    expect(rootResult[3]).toEqual([]);

    // On
    const onResult = traverser.next().value!;
    expect(onResult[0]).toBe(root);
    expect(getValue(onResult[1])).toEqual("on");
    expect(onResult[2]).toBeUndefined();
    expect(onResult[3]).toEqual([root]);

    // Push
    const pushResult = traverser.next().value!;
    expect(pushResult[0]).toBe(root);
    expect(getValue(pushResult[1])).toEqual("push");
    expect(getValue(pushResult[2])).toEqual("on");
    expect(pushResult[3]).toEqual([root]);
  });

  it("returns ancestors for nested mappings", () => {
    const workflow = parseWorkflow(
      {
        name: "wf.yaml",
        content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest`
      },
      nullTrace
    );

    const root = workflow.value!;
    const results = Array.from(TemplateToken.traverse(root));

    // Find the "ubuntu-latest" token
    const ubuntuResult = results.find(r => getValue(r[1]) === "ubuntu-latest")!;
    expect(ubuntuResult).toBeDefined();

    // Ancestors should be: root -> jobs mapping -> build mapping
    const ancestors = ubuntuResult[3];
    expect(ancestors.length).toBe(3);
    expect(ancestors[0]).toBe(root);
    expect(ancestors[1]).toBeInstanceOf(MappingToken); // jobs mapping
    expect(ancestors[2]).toBeInstanceOf(MappingToken); // build mapping
  });

  it("returns ancestors for sequences", () => {
    const workflow = parseWorkflow(
      {
        name: "wf.yaml",
        content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hello`
      },
      nullTrace
    );

    const root = workflow.value!;
    const results = Array.from(TemplateToken.traverse(root));

    // Find the "echo hello" token
    const echoResult = results.find(r => getValue(r[1]) === "echo hello")!;
    expect(echoResult).toBeDefined();

    // Ancestors should be: root -> jobs mapping -> build mapping -> steps sequence -> step mapping
    const ancestors = echoResult[3];
    expect(ancestors.length).toBe(5);
    expect(ancestors[0]).toBe(root);
    expect(ancestors[1]).toBeInstanceOf(MappingToken); // jobs mapping
    expect(ancestors[2]).toBeInstanceOf(MappingToken); // build mapping
    expect(ancestors[3]).toBeInstanceOf(SequenceToken); // steps sequence
    expect(ancestors[4]).toBeInstanceOf(MappingToken); // step mapping
  });

  it("returns correct ancestors for matrix values", () => {
    const workflow = parseWorkflow(
      {
        name: "wf.yaml",
        content: `on: push
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [a, b]
    steps:
      - run: echo hi`
      },
      nullTrace
    );

    const root = workflow.value!;
    const results = Array.from(TemplateToken.traverse(root));

    // Find the "a" token (first matrix value)
    const nodeValueResult = results.find(r => {
      const token = r[1];
      return token instanceof StringToken && token.value === "a";
    })!;
    expect(nodeValueResult).toBeDefined();

    // Ancestors: root -> jobs mapping -> build mapping -> strategy mapping -> matrix mapping -> node sequence
    const ancestors = nodeValueResult[3];
    expect(ancestors.length).toBeGreaterThanOrEqual(5);
    expect(ancestors[0]).toBe(root);
    // Last ancestor should be the sequence containing [a, b]
    expect(ancestors[ancestors.length - 1]).toBeInstanceOf(SequenceToken);
  });
});

function getValue(token: TemplateToken | undefined): string {
  if (token instanceof StringToken) {
    return token.value;
  }

  return "";
}
