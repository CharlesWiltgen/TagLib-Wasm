/**
 * @fileoverview Auto-initializing TagLib wrapper for zero-config usage
 * 
 * This module provides a TagLib interface that automatically initializes
 * on first use, removing the need for explicit initialization.
 * 
 * @example
 * ```typescript
 * import { TagLib } from "taglib-wasm/auto";
 * 
 * // No need to call initialize() - happens automatically
 * const file = await TagLib.openFile("song.mp3");
 * console.log(file.tag().title);
 * file.dispose();
 * ```
 */

import { TagLib as BaseTagLib } from "./taglib.ts";
import type { AudioFile } from "./taglib.ts";
import type { TagLibConfig } from "./types.ts";

// Cached instance and initialization promise
let instance: BaseTagLib | null = null;
let initPromise: Promise<BaseTagLib> | null = null;

/**
 * Default configuration for auto-initialization
 */
const DEFAULT_CONFIG: TagLibConfig = {
  debug: false,
  memory: {
    initial: 16 * 1024 * 1024, // 16MB
    maximum: 64 * 1024 * 1024, // 64MB
  },
};

/**
 * Get or create the TagLib instance
 */
async function getInstance(): Promise<BaseTagLib> {
  if (instance) {
    return instance;
  }
  
  if (!initPromise) {
    initPromise = BaseTagLib.initialize(DEFAULT_CONFIG).then(taglib => {
      instance = taglib;
      return taglib;
    });
  }
  
  return initPromise;
}

/**
 * Read file data from various sources
 */
async function readFileData(file: string | Uint8Array | ArrayBuffer | File): Promise<Uint8Array> {
  // Already a Uint8Array
  if (file instanceof Uint8Array) {
    return file;
  }
  
  // ArrayBuffer - convert to Uint8Array
  if (file instanceof ArrayBuffer) {
    return new Uint8Array(file);
  }
  
  // File object (browser)
  if (typeof File !== 'undefined' && file instanceof File) {
    return new Uint8Array(await file.arrayBuffer());
  }
  
  // String path - read from filesystem
  if (typeof file === 'string') {
    // Deno
    if (typeof Deno !== 'undefined') {
      return await Deno.readFile(file);
    }
    
    // Node.js
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const { readFile } = await import('fs/promises');
      return new Uint8Array(await readFile(file));
    }
    
    // Bun
    if (typeof (globalThis as any).Bun !== 'undefined') {
      const bunFile = (globalThis as any).Bun.file(file);
      return new Uint8Array(await bunFile.arrayBuffer());
    }
    
    throw new Error('File path reading not supported in this environment');
  }
  
  throw new Error('Invalid file input type');
}

/**
 * Auto-initializing TagLib wrapper
 * 
 * This class provides the same interface as the regular TagLib class,
 * but automatically initializes on first use.
 */
export class TagLib {
  /**
   * Private constructor - use static methods instead
   */
  private constructor() {}
  
  /**
   * Initialize TagLib with custom configuration
   * 
   * This method is optional - TagLib will auto-initialize with defaults
   * if you don't call this explicitly.
   * 
   * @param config - Optional configuration
   * @returns Promise that resolves when initialized
   */
  static async initialize(config?: TagLibConfig): Promise<void> {
    if (instance) {
      return; // Already initialized
    }
    
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    instance = await BaseTagLib.initialize(mergedConfig);
  }
  
  /**
   * Open an audio file from various sources
   * 
   * @param file - File path, Uint8Array buffer, ArrayBuffer, or File object
   * @returns AudioFile instance
   * 
   * @example
   * ```typescript
   * // From file path (Node.js/Deno/Bun)
   * const file = await TagLib.openFile("song.mp3");
   * 
   * // From buffer
   * const buffer = await fetch("song.mp3").then(r => r.arrayBuffer());
   * const file = await TagLib.openFile(buffer);
   * 
   * // From File object (browser)
   * const fileInput = document.querySelector('input[type="file"]');
   * const file = await TagLib.openFile(fileInput.files[0]);
   * ```
   */
  static async openFile(file: string | Uint8Array | ArrayBuffer | File): Promise<AudioFile> {
    const taglib = await getInstance();
    const audioData = await readFileData(file);
    return taglib.openFile(audioData);
  }
  
  /**
   * Create an AudioFile from a buffer (convenience method)
   * 
   * @param buffer - Audio file data
   * @returns AudioFile instance
   */
  static async fromBuffer(buffer: Uint8Array): Promise<AudioFile> {
    const taglib = await getInstance();
    return taglib.openFile(buffer);
  }
  
  /**
   * Get the underlying TagLib module (advanced usage)
   * 
   * @returns The WebAssembly module interface
   */
  static async getModule() {
    const taglib = await getInstance();
    return taglib.getModule();
  }
  
  /**
   * Check if TagLib is initialized
   * 
   * @returns true if initialized
   */
  static isInitialized(): boolean {
    return instance !== null;
  }
  
  /**
   * Reset the instance (mainly for testing)
   * 
   * This will force re-initialization on next use.
   */
  static reset(): void {
    instance = null;
    initPromise = null;
  }
}

/**
 * Convenience function for quick one-off operations
 * 
 * @param file - File to process
 * @param operation - Function that processes the AudioFile
 * @returns Result of the operation
 * 
 * @example
 * ```typescript
 * const tags = await withFile("song.mp3", file => file.tag());
 * console.log(tags.title);
 * 
 * await withFile("song.mp3", file => {
 *   file.setTitle("New Title");
 *   file.save();
 * });
 * ```
 */
export async function withFile<T>(
  file: string | Uint8Array | ArrayBuffer | File,
  operation: (file: AudioFile) => T | Promise<T>
): Promise<T> {
  const audioFile = await TagLib.openFile(file);
  try {
    return await operation(audioFile);
  } finally {
    audioFile.dispose();
  }
}

// Re-export types for convenience
export type { AudioFile } from "./taglib.ts";
export type { Tag, AudioProperties, ExtendedTag, TagLibConfig } from "./types.ts";