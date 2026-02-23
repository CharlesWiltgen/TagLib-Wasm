#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * @fileoverview Bundle TagLib-Wasm for Deno compile
 *
 * This script creates a single bundled module that includes all dependencies
 * statically, making it suitable for use with `deno compile`.
 */

import { ensureDir } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

const OUTPUT_DIR = "./dist/deno-compile";
const BUNDLE_FILE = "taglib-wasm-bundle.js";

async function bundle() {
  console.log("🎯 Bundling TagLib-Wasm for Deno compile...");

  // Ensure output directory exists
  await ensureDir(OUTPUT_DIR);

  // Bundle the static module
  const bundleResult = await new Deno.Command("deno", {
    args: [
      "bundle",
      "--no-check", // Skip type checking for faster bundling
      "./mod-static.ts",
      join(OUTPUT_DIR, BUNDLE_FILE),
    ],
  }).output();

  if (!bundleResult.success) {
    console.error("❌ Bundle failed:");
    console.error(new TextDecoder().decode(bundleResult.stderr));
    Deno.exit(1);
  }

  console.log(`✅ Bundle created at ${join(OUTPUT_DIR, BUNDLE_FILE)}`);

  // Copy the WASM file to the output directory
  console.log("📦 Copying WASM file...");
  await Deno.copyFile("./build/taglib.wasm", join(OUTPUT_DIR, "taglib.wasm"));
  console.log(`✅ WASM file copied to ${join(OUTPUT_DIR, "taglib.wasm")}`);

  // Create a usage example
  const exampleContent = `#!/usr/bin/env -S deno run --allow-read

/**
 * Example of using bundled TagLib-Wasm with Deno compile
 * 
 * Compile this example:
 * deno compile --allow-read --include ./taglib.wasm example-deno-compile.ts
 */

import { TagLib, readTags } from "./taglib-wasm-bundle.js";

// Example 1: Using the TagLib API
async function taglibApiExample() {
  // Initialize with embedded WASM
  const wasmBinary = await Deno.readFile("./taglib.wasm");
  const taglib = await TagLib.initialize({ wasmBinary });
  
  // Open and read a file
  const audioData = await Deno.readFile("./audio.mp3");
  const file = await taglib.open(audioData);
  
  const tag = file.tag();
  console.log("Title:", tag.title);
  console.log("Artist:", tag.artist);
  
  file.dispose();
}

// Example 2: Using the Simple API
async function simpleApiExample() {
  const tags = await readTags("./audio.mp3");
  console.log("Tags:", tags);
}

// Run example based on command line argument
if (Deno.args[0] === "simple") {
  await simpleApiExample();
} else {
  await taglibApiExample();
}
`;

  await Deno.writeTextFile(
    join(OUTPUT_DIR, "example-deno-compile.ts"),
    exampleContent,
  );
  console.log(
    `✅ Example created at ${join(OUTPUT_DIR, "example-deno-compile.ts")}`,
  );

  // Create README
  const readmeContent = `# Deno Compile Bundle

This directory contains a pre-bundled version of TagLib-Wasm suitable for use with \`deno compile\`.

## Files

- \`taglib-wasm-bundle.js\` - The bundled TagLib-Wasm module with all dependencies
- \`taglib.wasm\` - The WebAssembly binary
- \`example-deno-compile.ts\` - Example usage

## Usage

### 1. Import the bundle in your project:

\`\`\`typescript
import { TagLib, readTags } from "./dist/deno-compile/taglib-wasm-bundle.js";
\`\`\`

### 2. Include the WASM file when compiling:

\`\`\`bash
deno compile --allow-read --include ./dist/deno-compile/taglib.wasm your-app.ts
\`\`\`

### 3. Initialize with embedded WASM:

\`\`\`typescript
// Read the embedded WASM file
const wasmBinary = await Deno.readFile("./taglib.wasm");

// Initialize TagLib with the embedded binary
const taglib = await TagLib.initialize({ wasmBinary });
\`\`\`

## Complete Example

\`\`\`typescript
import { TagLib } from "./dist/deno-compile/taglib-wasm-bundle.js";

// Read embedded WASM
const wasmBinary = await Deno.readFile("./taglib.wasm");
const taglib = await TagLib.initialize({ wasmBinary });

// Use TagLib
const file = await taglib.open("song.mp3");
const tag = file.tag();
console.log(\`Title: \${tag.title}\`);
file.dispose();
\`\`\`

## Compile and Run

\`\`\`bash
# Compile the example
cd dist/deno-compile
deno compile --allow-read --include ./taglib.wasm example-deno-compile.ts

# Run the compiled binary
./example-deno-compile
\`\`\`
`;

  await Deno.writeTextFile(join(OUTPUT_DIR, "README.md"), readmeContent);
  console.log(`✅ README created at ${join(OUTPUT_DIR, "README.md")}`);

  console.log("\n🎉 Bundle complete! Next steps:");
  console.log(`1. cd ${OUTPUT_DIR}`);
  console.log(
    "2. deno compile --allow-read --include ./taglib.wasm example-deno-compile.ts",
  );
  console.log("3. ./example-deno-compile");
}

// Run the bundler
if (import.meta.main) {
  await bundle();
}
