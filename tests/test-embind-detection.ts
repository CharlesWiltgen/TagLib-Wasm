#!/usr/bin/env -S deno run --allow-read --allow-net

/**
 * Detect if the WASM module actually uses Embind
 */

// Import the factory function
const TagLibModule = await import("../build/taglib.js");
const createTagLibModule = TagLibModule.default || TagLibModule.createTagLibModule;

console.log("🔍 Detecting Embind usage in WASM module...");

try {
  // Load the module
  console.log("📦 Loading TagLib module from Emscripten JS...");
  const module = await createTagLibModule();
  
  console.log("\n📋 Module properties:");
  const moduleKeys = Object.keys(module).sort();
  moduleKeys.forEach(key => {
    const value = module[key];
    const type = typeof value;
    if (type === 'function') {
      console.log(`  - ${key}: function`);
    } else if (type === 'object' && value !== null) {
      console.log(`  - ${key}: object`);
    } else {
      console.log(`  - ${key}: ${type} = ${JSON.stringify(value)}`);
    }
  });
  
  // Look specifically for Embind classes
  console.log("\n🔍 Looking for Embind classes:");
  const embindClasses = ['FileHandle', 'TagWrapper', 'AudioPropertiesWrapper', 'createFileHandle'];
  embindClasses.forEach(className => {
    const hasClass = className in module;
    const classType = hasClass ? typeof module[className] : 'not found';
    console.log(`  - ${className}: ${hasClass ? '✅' : '❌'} (${classType})`);
  });
  
  // Check for C-style functions (non-Embind)
  console.log("\n🔍 Looking for C-style exports:");
  const cFunctions = ['_taglib_file_new_from_buffer', '_taglib_file_delete', '_taglib_file_save'];
  cFunctions.forEach(funcName => {
    const hasFunc = funcName in module;
    const funcType = hasFunc ? typeof module[funcName] : 'not found';
    console.log(`  - ${funcName}: ${hasFunc ? '✅' : '❌'} (${funcType})`);
  });
  
  // Test if we can create an instance
  if (module.FileHandle) {
    console.log("\n🧪 Testing FileHandle instantiation:");
    try {
      const handle = new module.FileHandle();
      console.log("  - Created instance: ✅");
      console.log("  - Instance type:", Object.prototype.toString.call(handle));
      console.log("  - Has loadFromBuffer:", 'loadFromBuffer' in handle);
      console.log("  - Has getTag:", 'getTag' in handle);
      console.log("  - Has getAudioProperties:", 'getAudioProperties' in handle);
      
      // Check for $$ property (Embind internal)
      console.log("  - Has $$ (Embind internal):", '$$' in handle);
      
      handle.delete();
    } catch (e) {
      console.log("  - Error creating instance:", e.message);
    }
  }
  
  // Check if createFileHandle exists
  if (module.createFileHandle) {
    console.log("\n🧪 Testing createFileHandle:");
    try {
      const handle = module.createFileHandle();
      console.log("  - Created instance: ✅");
      handle.delete();
    } catch (e) {
      console.log("  - Error:", e.message);
    }
  }
  
} catch (error) {
  console.error("❌ Error:", error);
  Deno.exit(1);
}