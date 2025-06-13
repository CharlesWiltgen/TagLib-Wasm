/**
 * @fileoverview JSR-compatible WASM module interface (no Node.js dependencies)
 */

// Re-export types only (no implementation imports)
export type {
  EmscriptenModule,
  FileHandle,
  TagWrapper,
  AudioPropertiesWrapper,
  TagLibModule,
  WasmModule,
} from "./wasm.ts";