#!/usr/bin/env node

/**
 * Fix import/export statements in compiled JavaScript files
 * Adds .js extension to relative imports for Deno compatibility
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

function fixImportsInFile(filePath) {
  let content = readFileSync(filePath, "utf8");
  let modified = false;

  // Fix import statements
  content = content.replace(
    /from\s+["'](\.[^"']+)["']/g,
    (match, importPath) => {
      // Handle .ts.js case from esbuild
      if (importPath.endsWith(".ts.js")) {
        modified = true;
        return `from "${importPath.replace(/\.ts\.js$/, '.js')}"`;
      } else if (importPath.endsWith(".ts")) {
        modified = true;
        return `from "${importPath.replace(/\.ts$/, '')}.js"`;
      } else if (!importPath.endsWith(".js") && !importPath.endsWith(".json")) {
        modified = true;
        return `from "${importPath}.js"`;
      }
      return match;
    }
  );

  // Fix export statements
  content = content.replace(
    /export\s+.*\s+from\s+["'](\.[^"']+)["']/g,
    (match, importPath) => {
      // Handle .ts.js case from esbuild
      if (importPath.endsWith(".ts.js")) {
        modified = true;
        return match.replace(/\.ts\.js/, '.js');
      } else if (importPath.endsWith(".ts")) {
        modified = true;
        return match.replace(importPath, importPath.replace(/\.ts$/, '') + ".js");
      } else if (!importPath.endsWith(".js") && !importPath.endsWith(".json")) {
        modified = true;
        return match.replace(importPath, importPath + ".js");
      }
      return match;
    }
  );

  // Fix dynamic imports
  content = content.replace(
    /import\(["'](\.[^"']+)["']\)/g,
    (match, importPath) => {
      // Handle .ts.js case from esbuild
      if (importPath.endsWith(".ts.js")) {
        modified = true;
        return `import("${importPath.replace(/\.ts\.js$/, '.js')}")`;
      } else if (importPath.endsWith(".ts")) {
        modified = true;
        return `import("${importPath.replace(/\.ts$/, '')}.js")`;
      } else if (!importPath.endsWith(".js") && !importPath.endsWith(".json")) {
        modified = true;
        return `import("${importPath}.js")`;
      }
      return match;
    }
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