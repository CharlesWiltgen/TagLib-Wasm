/**
 * @fileoverview JSR-compatible TagLib implementation
 *
 * This version uses direct WASM loading without Emscripten's JS file
 * to be compatible with JSR publishing requirements.
 */

import { AudioFileImpl, TagLib as TagLibBase, createTagLib } from "./taglib.ts";
import type { AudioFile, Tag, AudioProperties, FileType, PropertyMap } from "./taglib.ts";
import { loadTagLibModuleJSR } from "./wasm-jsr.ts";
import type { TagLibConfig } from "./types.ts";
import type { WasmModule } from "./wasm.ts";

// Re-export types and implementations
export { AudioFileImpl as AudioFileJSR } from "./taglib.ts";
export type { Tag, AudioProperties, FileType, PropertyMap } from "./taglib.ts";

/**
 * JSR-compatible TagLib singleton for WASM module management
 */
export class TagLibJSR extends TagLibBase {
  private static instance: TagLibJSR | null = null;
  private static initialized = false;

  static async getInstance(): Promise<TagLibJSR> {
    if (!TagLibJSR.instance) {
      const module = await loadTagLibModuleJSR();
      TagLibJSR.instance = new TagLibJSR(module as unknown as WasmModule);
      TagLibJSR.initialized = true;
    }
    return TagLibJSR.instance;
  }

  static async initialize(config?: TagLibConfig): Promise<void> {
    if (!TagLibJSR.initialized) {
      await TagLibJSR.getInstance();
    }
  }

  /**
   * Open a file from a buffer (JSR-compatible version)
   */
  override async openFile(buffer: ArrayBuffer): Promise<AudioFile> {
    return super.openFile(buffer);
  }
}

// Export alias for compatibility
export { TagLibJSR as TagLib };