#!/usr/bin/env node

/**
 * Detect if the WASM module actually uses Embind (Node.js version)
 */

const createTagLibModule = require("../build/taglib.js");

console.log("🔍 Detecting Embind usage in WASM module...");

(async () => {
  try {
    // Load the module
    console.log("📦 Loading TagLib module from Emscripten JS...");
    const module = await createTagLibModule();
    
    console.log("\n📋 Module properties (first 30):");
    const moduleKeys = Object.keys(module).sort();
    moduleKeys.slice(0, 30).forEach(key => {
      const value = module[key];
      const type = typeof value;
      if (type === 'function') {
        console.log(`  - ${key}: function`);
      } else if (type === 'object' && value !== null) {
        console.log(`  - ${key}: object`);
      } else if (type === 'number' || type === 'boolean' || type === 'string') {
        console.log(`  - ${key}: ${type}`);
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
        console.log("  - Instance type:", Object.prototype.toString.call(handle));
        handle.delete();
      } catch (e) {
        console.log("  - Error:", e.message);
      }
    }
    
    console.log("\n🎯 Conclusion: The module " + (module.FileHandle ? "DOES" : "DOES NOT") + " use Embind");
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
})();