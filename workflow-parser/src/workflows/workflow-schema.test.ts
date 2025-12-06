import {getWorkflowSchema} from "./workflow-schema";

describe("workflow-schema", () => {
  it("loads successfully from workflow-root-strict entry point", () => {
    const schema = getWorkflowSchema();
    expect(schema).toBeDefined();

    // Verify entry point exists
    const rootDef = schema.getDefinition("workflow-root-strict");
    expect(rootDef).toBeDefined();
  });

  it("has all referenced definitions reachable from workflow-root-strict", () => {
    const schema = getWorkflowSchema();
    const definitions = schema.definitions;

    // Collect all type references from all definitions
    const referencedTypes = new Set<string>();
    const definedTypes = new Set<string>();

    for (const name of Object.keys(definitions)) {
      definedTypes.add(name);
      collectReferences(definitions[name], referencedTypes);
    }

    // Every referenced type should be defined
    const missingDefinitions: string[] = [];
    for (const ref of referencedTypes) {
      // Skip built-in types
      if (isBuiltInType(ref)) continue;

      if (!definedTypes.has(ref)) {
        missingDefinitions.push(ref);
      }
    }

    expect(missingDefinitions).toEqual([]);
  });

  it("can resolve key workflow definitions", () => {
    const schema = getWorkflowSchema();

    // These are critical definitions that must exist
    const criticalDefinitions = [
      "workflow-root-strict",
      "jobs",
      "steps",
      "runs-on",
      "step-uses",
      "job-env",
      "step-env",
    ];

    for (const defName of criticalDefinitions) {
      const def = schema.getDefinition(defName);
      expect(def).toBeDefined();
    }
  });
});

function collectReferences(obj: unknown, refs: Set<string>): void {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === "string") refs.add(item);
      else collectReferences(item, refs);
    }
    return;
  }

  const record = obj as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (["type", "item-type", "loose-key-type", "loose-value-type"].includes(key)) {
      if (typeof value === "string") refs.add(value);
    } else if (key === "one-of" || key === "properties" || key === "mapping" || key === "sequence") {
      collectReferences(value, refs);
    }
  }
}

function isBuiltInType(typeName: string): boolean {
  const builtIns = ["null", "boolean", "number", "string", "sequence", "mapping", "any"];
  return builtIns.includes(typeName);
}
