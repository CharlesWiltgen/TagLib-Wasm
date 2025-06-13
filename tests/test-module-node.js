#!/usr/bin/env node

/**
 * Understand the Emscripten module structure (Node version)
 */

const createTagLibModule = require("../build/taglib.js");

console.log("🔍 Understanding Emscripten module structure...");

(async () => {
  // Create the module with a custom instantiateWasm to intercept
  const module = await createTagLibModule({
    onRuntimeInitialized: () => {
      console.log("\n✅ Runtime initialized!");
    },
    locateFile: (path) => {
      console.log(`📁 locateFile called for: ${path}`);
      return "./build/" + path;
    }
  });

  console.log("\n🎯 Final module structure:");
  console.log("Has FileHandle:", 'FileHandle' in module);
  console.log("Has TagWrapper:", 'TagWrapper' in module);
  console.log("Has AudioPropertiesWrapper:", 'AudioPropertiesWrapper' in module);
  console.log("Has createFileHandle:", 'createFileHandle' in module);
  
  // Show what's actually in the module
  const moduleKeys = Object.keys(module).filter(k => typeof module[k] === 'function' && !k.startsWith('_'));
  console.log("\nPublic functions:", moduleKeys);

  // Test creating an instance
  if (module.FileHandle) {
    console.log("\n🧪 Testing FileHandle:");
    const handle = new module.FileHandle();
    console.log("Created:", handle);
    console.log("Has $$:", '$$' in handle);
    console.log("Methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(handle)).filter(m => m !== 'constructor'));
    handle.delete();
  }
})();