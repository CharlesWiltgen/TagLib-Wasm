#!/usr/bin/env node

/**
 * Fix import/export statements in compiled JavaScript files
 * Adds .js extension to relative imports for Deno compatibility
 * Also fixes taglib-wrapper.js import paths
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

function fixImportsInFile(filePath) {
  let content = readFileSync(filePath, "utf8");
  let modified = false;

  // Fix taglib-wrapper.js imports
  // From dist/index.js: "./build/taglib-wrapper.js" -> "./taglib-wrapper.js"
  if (filePath.endsWith("dist/index.js")) {
    content = content.replace(
      /from\s+["']\.\/build\/taglib-wrapper\.js["']/g,
      'from "./taglib-wrapper.js"',
    );
    content = content.replace(
      /import\(["']\.\/build\/taglib-wrapper\.js["']\)/g,
      'import("./taglib-wrapper.js")',
    );
    modified = true;
  }

  // From dist/src/wasm-workers.js: "../build/taglib-wrapper.js" -> "../taglib-wrapper.js"
  if (filePath.endsWith("dist/src/wasm-workers.js")) {
    content = content.replace(
      /from\s+["']\.\.\/build\/taglib-wrapper\.js["']/g,
      'from "../taglib-wrapper.js"',
    );
    content = content.replace(
      /import\(["']\.\.\/build\/taglib-wrapper\.js["']\)/g,
      'import("../taglib-wrapper.js")',
    );
    modified = true;
  }

  // Fix import statements
  content = content.replace(
    /from\s+["'](\.[^"']+)["']/g,
    (match, importPath) => {
      // Handle .ts.js case from esbuild
      if (importPath.endsWith(".ts.js")) {
        modified = true;
        return `from "${importPath.replace(/\.ts\.js$/, ".js")}"`;
      } else if (importPath.endsWith(".ts")) {
        modified = true;
        return `from "${importPath.replace(/\.ts$/, "")}.js"`;
      } else if (!importPath.endsWith(".js") && !importPath.endsWith(".json")) {
        modified = true;
        return `from "${importPath}.js"`;
      }
      return match;
    },
  );

  // Fix export statements
  content = content.replace(
    /export\s+.*\s+from\s+["'](\.[^"']+)["']/g,
    (match, importPath) => {
      // Handle .ts.js case from esbuild
      if (importPath.endsWith(".ts.js")) {
        modified = true;
        return match.replace(/\.ts\.js/, ".js");
      } else if (importPath.endsWith(".ts")) {
        modified = true;
        return match.replace(
          importPath,
          importPath.replace(/\.ts$/, "") + ".js",
        );
      } else if (!importPath.endsWith(".js") && !importPath.endsWith(".json")) {
        modified = true;
        return match.replace(importPath, importPath + ".js");
      }
      return match;
    },
  );

  // Fix dynamic imports
  content = content.replace(
    /import\(["'](\.[^"']+)["']\)/g,
    (match, importPath) => {
      // Handle .ts.js case from esbuild
      if (importPath.endsWith(".ts.js")) {
        modified = true;
        return `import("${importPath.replace(/\.ts\.js$/, ".js")}")`;
      } else if (importPath.endsWith(".ts")) {
        modified = true;
        return `import("${importPath.replace(/\.ts$/, "")}.js")`;
      } else if (!importPath.endsWith(".js") && !importPath.endsWith(".json")) {
        modified = true;
        return `import("${importPath}.js")`;
      }
      return match;
    },
  );

  if (modified) {
    writeFileSync(filePath, content);
    console.log(`    ✓ Fixed imports in ${filePath}`);
  }
}

function processDirectory(dir) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (extname(entry) === ".js") {
      fixImportsInFile(fullPath);
    }
  }
}

console.log("🔧 Fixing import statements in dist...");
processDirectory("dist");
console.log("✨ Import fix complete!");
