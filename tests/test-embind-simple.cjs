const path = require("path");
const createTagLibModule = require(path.join(__dirname, "../build/taglib.js"));

async function test() {
  console.log("Loading module...");
  const module = await createTagLibModule();
  console.log("Module loaded!");
  console.log("Available properties:", Object.keys(module).slice(0, 20));
  
  // Check for Embind classes
  const embindClasses = Object.keys(module).filter(k => {
    try {
      return typeof module[k] === 'function' && k[0] === k[0].toUpperCase();
    } catch (e) {
      return false;
    }
  });
  console.log("Embind classes:", embindClasses);
  
  // Try to create a FileHandle
  try {
    if (module.createFileHandle) {
      const fileHandle = module.createFileHandle();
      console.log("FileHandle created:", fileHandle);
      console.log("FileHandle type:", typeof fileHandle);
      console.log("FileHandle constructor:", fileHandle.constructor.name);
    } else {
      console.log("createFileHandle not found");
    }
  } catch (e) {
    console.error("Error creating FileHandle:", e.message);
  }
}

test().catch(console.error);