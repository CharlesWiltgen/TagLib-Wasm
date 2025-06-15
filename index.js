/**
 * @fileoverview Main module exports for taglib-wasm
 *
 * TagLib v2.1 compiled to WebAssembly with TypeScript bindings
 * for universal audio metadata handling.
 */
export {
  AudioFileImpl as AudioFile,
  createTagLib,
  TagLib,
} from "./src/taglib.ts";
/**
 * Load the TagLib Wasm module
 */
export async function loadTagLibModule() {
  // Now that we're using ES6 modules, we can use dynamic import directly
  const { default: createTagLibModule } = await import("./build/taglib.js");
  const module = await createTagLibModule();
  return module;
}
//# sourceMappingURL=index.js.map
