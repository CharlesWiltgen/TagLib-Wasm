#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Generate a static build of taglib-wasm for Deno compile
 *
 * This script creates modified versions of the source files that use
 * static imports instead of dynamic imports.
 */

import { ensureDir } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

const STATIC_BUILD_DIR = "./build/static";

async function generateStaticBuild() {
  console.log("🔨 Generating static build for Deno compile...");

  // Ensure output directory exists
  await ensureDir(STATIC_BUILD_DIR);
  await ensureDir(join(STATIC_BUILD_DIR, "src"));

  // 1. Create static index.ts that doesn't use dynamic imports
  console.log("📝 Creating static index.ts...");
  let indexContent = await Deno.readTextFile("./index.ts");

  // Add import at the top of the file
  const importStatement =
    'import createTagLibModule from "./build/taglib-wrapper.js";\n';
  if (!indexContent.includes(importStatement)) {
    // Find the first import or export statement
    const firstImportMatch = indexContent.match(/^(import|export)/m);
    if (firstImportMatch) {
      const insertPos = firstImportMatch.index!;
      indexContent = indexContent.slice(0, insertPos) + importStatement +
        indexContent.slice(insertPos);
    } else {
      // Add after any initial comments
      indexContent = importStatement + indexContent;
    }
  }

  // Replace the dynamic import with a reference to the imported module
  const staticIndexContent = indexContent
    .replace(
      /const { default: createTagLibModule } = await import\(\s*"\.\/build\/taglib-wrapper\.js"\s*\);/g,
      "// Static import used instead of dynamic import",
    );
  await Deno.writeTextFile(
    join(STATIC_BUILD_DIR, "index.ts"),
    staticIndexContent,
  );

  // 2. Create static taglib.ts
  console.log("📝 Creating static taglib.ts...");
  const taglibContent = await Deno.readTextFile("./src/taglib.ts");
  const staticTaglibContent = taglibContent.replace(
    /const { loadTagLibModule } = await import\("\.\.\/index\.ts"\);/,
    'import { loadTagLibModule } from "../index.ts";',
  );
  await Deno.writeTextFile(
    join(STATIC_BUILD_DIR, "src/taglib.ts"),
    staticTaglibContent,
  );

  // 3. Create static simple.ts
  console.log("📝 Creating static simple.ts...");
  const simpleContent = await Deno.readTextFile("./src/simple.ts");
  const staticSimpleContent = simpleContent.replace(
    /const { TagLib } = await import\("\.\/taglib\.ts"\);/,
    'import { TagLib } from "./taglib.ts";',
  );
  await Deno.writeTextFile(
    join(STATIC_BUILD_DIR, "src/simple.ts"),
    staticSimpleContent,
  );

  // 4. Create static wasm-workers.ts
  console.log("📝 Creating static wasm-workers.ts...");
  const workersContent = await Deno.readTextFile("./src/wasm-workers.ts");
  const staticWorkersContent = workersContent.replace(
    /const wasmModule = await import\("\.\.\/build\/taglib-wrapper\.js"\);/,
    'import wasmModule from "../build/taglib-wrapper.js";',
  );
  await Deno.writeTextFile(
    join(STATIC_BUILD_DIR, "src/wasm-workers.ts"),
    staticWorkersContent,
  );

  // 5. Create static file utils
  console.log("📝 Creating static file utils...");
  await ensureDir(join(STATIC_BUILD_DIR, "src/utils"));

  const fileUtilContent = await Deno.readTextFile("./src/utils/file.ts");
  const staticFileUtilContent = fileUtilContent.replace(
    /const { readFile } = await import\("fs\/promises"\);/,
    '// Dynamic import removed for static build\n        throw new Error("Node.js file operations not available in static build");',
  );
  await Deno.writeTextFile(
    join(STATIC_BUILD_DIR, "src/utils/file.ts"),
    staticFileUtilContent,
  );

  const writeUtilContent = await Deno.readTextFile("./src/utils/write.ts");
  const staticWriteUtilContent = writeUtilContent.replace(
    /const { writeFile } = await import\("fs\/promises"\);/,
    '// Dynamic import removed for static build\n      throw new Error("Node.js file operations not available in static build");',
  );
  await Deno.writeTextFile(
    join(STATIC_BUILD_DIR, "src/utils/write.ts"),
    staticWriteUtilContent,
  );

  // 6. Copy other necessary files
  console.log("📁 Copying supporting files...");
  const filesToCopy = [
    "src/errors.ts",
    "src/types.ts",
    "src/workers.ts",
    "src/constants.ts",
    "src/file-utils.ts",
    "src/web-utils.ts",
    "src/wasm.ts",
    "build/taglib-wrapper.js",
    "build/taglib.wasm",
  ];

  for (const file of filesToCopy) {
    const destPath = join(STATIC_BUILD_DIR, file);
    await ensureDir(join(destPath, ".."));
    await Deno.copyFile(file, destPath);
  }

  // 7. Create the main entry point
  console.log("📝 Creating static entry point...");
  const entryContent = `/**
 * @module taglib-wasm/static
 * 
 * Static build entry point for Deno compile.
 * All imports are statically resolved.
 */

// Re-export everything from the static build
export * from "./index.ts";
export * from "./src/taglib.ts";
export * from "./src/simple.ts";
export * from "./src/errors.ts";
export * from "./src/types.ts";
export { TagLibWorkers, AudioFileWorkers } from "./src/workers.ts";

// Export a helper for Deno compile
export { initializeForDenoCompile } from "./src/deno-compile.ts";
`;
  await Deno.writeTextFile(join(STATIC_BUILD_DIR, "mod.ts"), entryContent);

  // Copy deno-compile.ts
  await Deno.copyFile(
    "src/deno-compile.ts",
    join(STATIC_BUILD_DIR, "src/deno-compile.ts"),
  );

  // 8. Create usage instructions
  const readmeContent = `# Static Build for Deno Compile

This directory contains a version of taglib-wasm with all dynamic imports replaced
by static imports, making it suitable for use with \`deno compile\`.

## Usage

1. Import from this directory instead of the main module:

\`\`\`typescript
import { TagLib } from "./build/static/mod.ts";
\`\`\`

2. When compiling, include the WASM file:

\`\`\`bash
deno compile --allow-read --include ./build/static/build/taglib.wasm your-app.ts
\`\`\`

3. Initialize with embedded WASM in your compiled binary:

\`\`\`typescript
import { initializeForDenoCompile } from "./build/static/mod.ts";

const taglib = await initializeForDenoCompile("./taglib.wasm");
\`\`\`

## Example

\`\`\`typescript
import { readTags } from "./build/static/mod.ts";

// The WASM file will be embedded in the binary
const tags = await readTags("song.mp3");
console.log(tags);
\`\`\`

## Building

To regenerate this static build:

\`\`\`bash
deno run --allow-read --allow-write scripts/generate-static-build.ts
\`\`\`
`;
  await Deno.writeTextFile(join(STATIC_BUILD_DIR, "README.md"), readmeContent);

  console.log("\n✅ Static build generated successfully!");
  console.log(`📁 Output directory: ${STATIC_BUILD_DIR}`);
  console.log("\nNext steps:");
  console.log("1. Use the static build in your project:");
  console.log(`   import { TagLib } from "./${STATIC_BUILD_DIR}/mod.ts";`);
  console.log("2. Compile with WASM included:");
  console.log(
    `   deno compile --allow-read --include ./${STATIC_BUILD_DIR}/build/taglib.wasm your-app.ts`,
  );
}

if (import.meta.main) {
  await generateStaticBuild();
}
