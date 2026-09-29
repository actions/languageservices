#!/usr/bin/env node

/**
 * Minifies JSON files by removing whitespace.
 *
 * Usage: node script/minify-json.js <file1.json> <file2.json> ...
 *
 * For each input file, creates a corresponding .min.json file.
 * Example: src/data.json -> src/data.min.json
 */

import {promises as fs} from "fs";
import path from "path";

const files = process.argv.slice(2);

if (files.length === 0) {
  console.error("Usage: node script/minify-json.js <file1.json> <file2.json> ...");
  process.exit(1);
}

for (const file of files) {
  try {
    const content = await fs.readFile(file, "utf8");
    const data = JSON.parse(content);
    const minified = JSON.stringify(data);

    // Replace .json with .min.json
    const ext = path.extname(file);
    const outputFile = file.slice(0, -ext.length) + ".min" + ext;

    await fs.writeFile(outputFile, minified);

    const originalSize = Buffer.byteLength(content, "utf8");
    const minifiedSize = Buffer.byteLength(minified, "utf8");
    const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

    console.log(`${file} -> ${outputFile} (${savings}% smaller)`);
  } catch (err) {
    console.error(`Error processing ${file}:`, err);
    process.exit(1);
  }
}
