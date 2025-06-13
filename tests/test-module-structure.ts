#!/usr/bin/env -S deno run --allow-read --allow-net

/**
 * Understand the Emscripten module structure
 */

// @ts-ignore
const { default: createTagLibModule } = await import("../build/taglib.js");

console.log("🔍 Understanding Emscripten module structure...");

// Create the module with a custom instantiateWasm to intercept
const module = await createTagLibModule({
  onRuntimeInitialized: () => {
    console.log("\n✅ Runtime initialized! Module contents:");
    console.log("Module keys:", Object.keys(module).filter(k => !k.startsWith('_')).sort());
  },
  locateFile: (path: string) => {
    console.log(`📁 locateFile called for: ${path}`);
    return "../build/" + path;
  }
});

console.log("\n🎯 Final module structure:");
console.log("Has FileHandle:", 'FileHandle' in module);
console.log("Has TagWrapper:", 'TagWrapper' in module);
console.log("Has AudioPropertiesWrapper:", 'AudioPropertiesWrapper' in module);
console.log("Has createFileHandle:", 'createFileHandle' in module);

// Test creating an instance
if (module.FileHandle) {
  console.log("\n🧪 Testing FileHandle:");
  const handle = new module.FileHandle();
  console.log("Created:", handle);
  console.log("Methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(handle)));
  handle.delete();
}