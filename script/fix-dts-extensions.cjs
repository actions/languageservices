#!/usr/bin/env node

/**
 * Post-build script to fix TypeScript's rewriteRelativeImportExtensions bug
 * where .d.ts files get .ts extensions instead of .js extensions.
 * See: https://github.com/microsoft/TypeScript/issues/61037
 */

const fs = require('fs');
const path = require('path');

function fixDtsFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;
    
    // Replace .ts extensions in import/export statements with .js
    // Matches: from "./foo.ts" or from './foo.ts'
    content = content.replace(/(from\s+["'])([^"']+)\.ts(["'])/g, '$1$2.js$3');
    
    // Matches: import("./foo.ts") or import('./foo.ts')
    content = content.replace(/(import\s*\(\s*["'])([^"']+)\.ts(["']\s*\))/g, '$1$2.js$3');
    
    // Matches: export * from "./foo.ts"
    content = content.replace(/(export\s+\*\s+from\s+["'])([^"']+)\.ts(["'])/g, '$1$2.js$3');
    
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed: ${filePath}`);
        return true;
    }
    return false;
}

function walkDir(dir, callback) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walkDir(filePath, callback);
        } else if (file.endsWith('.d.ts')) {
            callback(filePath);
        }
    }
}

function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: fix-dts-extensions.js <dist-dir> [<dist-dir2> ...]');
        process.exit(1);
    }
    
    let fixedCount = 0;
    for (const dir of args) {
        if (!fs.existsSync(dir)) {
            console.warn(`Directory not found: ${dir}`);
            continue;
        }
        walkDir(dir, (filePath) => {
            if (fixDtsFile(filePath)) {
                fixedCount++;
            }
        });
    }
    console.log(`Fixed ${fixedCount} .d.ts file(s)`);
}

main();
