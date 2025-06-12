import createTagLibModule from "../build/taglib.js";

console.log("Loading module...");
const module = await createTagLibModule();
console.log("Module loaded!");
console.log("Available classes:", Object.keys(module).filter(k => k[0] === k[0].toUpperCase()));

// Try to create a FileHandle
try {
  const fileHandle = module.createFileHandle();
  console.log("FileHandle created:", fileHandle);
  
  // Check methods
  console.log("FileHandle methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(fileHandle)));
} catch (e) {
  console.error("Error creating FileHandle:", e);
}