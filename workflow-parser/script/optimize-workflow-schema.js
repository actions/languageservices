#!/usr/bin/env node
/**
 * Optimizes workflow-v1.0.json by pruning unused definitions.
 *
 * Removes definitions not reachable from the entry point (workflow-root-strict).
 * Output is then minified by minify-json.js to produce the final .min.json file.
 *
 * Usage: node script/optimize-workflow-schema.js
 */

import {promises as fs} from "fs";
import path from "path";
import {fileURLToPath} from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENTRY_POINT = "workflow-root-strict";

const inputPath = path.join(__dirname, "..", "src", "workflow-v1.0.json");
const outputPath = path.join(__dirname, "..", "src", "workflow-v1.0.optimized.json");

/**
 * Find all type references in a definition.
 */
function findRefs(obj) {
  const refs = [];

  function visit(node) {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node)) {
      for (const item of node) {
        if (typeof item === "string") refs.push(item);
        else visit(item);
      }
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (["type", "item-type", "loose-key-type", "loose-value-type"].includes(key)) {
        if (typeof value === "string") refs.push(value);
      } else if (key === "one-of") {
        visit(value);
      } else if (key === "properties") {
        for (const propValue of Object.values(value)) {
          if (typeof propValue === "string") refs.push(propValue);
          else if (propValue && typeof propValue === "object") visit(propValue);
        }
      } else if (["mapping", "sequence", "string"].includes(key)) {
        visit(value);
      }
    }
  }

  visit(obj);
  return refs;
}

/**
 * Find all definitions reachable from entry point.
 */
function findReachable(schema, entryPoint) {
  const reachable = new Set();
  const queue = [entryPoint];

  while (queue.length > 0) {
    const name = queue.shift();
    if (reachable.has(name) || !schema.definitions[name]) continue;
    reachable.add(name);

    const refs = findRefs(schema.definitions[name]);
    for (const ref of refs) {
      if (!reachable.has(ref) && schema.definitions[ref]) {
        queue.push(ref);
      }
    }
  }

  return reachable;
}

async function main() {
  const content = await fs.readFile(inputPath, "utf8");
  const schema = JSON.parse(content);

  const reachable = findReachable(schema, ENTRY_POINT);
  const allDefs = Object.keys(schema.definitions);
  const unused = allDefs.filter((name) => !reachable.has(name));

  console.log(`Entry point: ${ENTRY_POINT}`);
  console.log(`Definitions: ${allDefs.length} -> ${reachable.size} (${unused.length} pruned)`);

  if (unused.length > 0) {
    console.log("\nPruned:");
    unused.forEach((name) => console.log(`  - ${name}`));
  }

  // Create pruned schema preserving definition order
  const pruned = {version: schema.version, definitions: {}};
  for (const name of allDefs) {
    if (reachable.has(name)) {
      pruned.definitions[name] = schema.definitions[name];
    }
  }

  // Write output (will be minified by minify-json.js)
  await fs.writeFile(outputPath, JSON.stringify(pruned));

  console.log(`\nOutput: ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
