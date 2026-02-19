#!/usr/bin/env node

/**
 * Fix import/export statements in compiled JavaScript files
 * Adds .js extension to relative imports for Deno compatibility
 * Also fixes taglib-wrapper.js import paths
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";

function fixImportsInFile(filePath) {
  let content = readFileSync(filePath, "utf8");
  let modified = false;

  // Fix taglib-wrapper.js imports for any file at any depth under dist/
  const distRoot = "dist";
  const relFromDist = relative(distRoot, dirname(filePath));
  const depth = relFromDist === "" ? 0 : relFromDist.split("/").length;
  const wrapperRelPath = (depth === 0 ? "./" : "../".repeat(depth)) +
    "taglib-wrapper.js";

  content = content.replace(
    /from\s+["'][^"']*(?:build|dist)\/taglib-wrapper\.js["']/g,
    `from "${wrapperRelPath}"`,
  );
  content = content.replace(
    /import\(["'][^"']*(?:build|dist)\/taglib-wrapper\.js["']\)/g,
    `import("${wrapperRelPath}")`,
  );
  modified = true;

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
