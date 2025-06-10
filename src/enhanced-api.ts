/**
 * Enhanced API patterns inspired by node-taglib
 * 
 * This file demonstrates potential API improvements that could be added
 * to TagLib WASM to improve developer experience.
 */

import type { AudioFile, TagLibConfig } from "./types.ts";

/**
 * Enhanced error handling with error codes
 */
export interface TagLibError extends Error {
  code: 'FILE_NOT_FOUND' | 'INVALID_FORMAT' | 'MEMORY_ERROR' | 'PERMISSION_DENIED' | 'WASM_ERROR';
  path?: string;
  format?: string;
  details?: string;
}

/**
 * Callback-style async operations (Node.js pattern)
 */
export type TagLibCallback<T> = (err: TagLibError | null, result?: T) => void;

/**
 * Enhanced input types
 */
export type AudioInput = 
  | string              // File path (Node.js/Deno/Bun only)
  | Uint8Array         // Raw bytes
  | ArrayBuffer        // ArrayBuffer
  | Buffer             // Node.js Buffer
  | File;              // Browser File object

/**
 * Enhanced TagLib class with multiple API patterns
 */
export class EnhancedTagLib {
  /**
   * Synchronous initialization (for server environments)
   */
  static initializeSync(config?: TagLibConfig): EnhancedTagLib {
    // Implementation would be synchronous version
    throw new Error("Not implemented");
  }

  /**
   * Asynchronous initialization (current pattern)
   */
  static async initialize(config?: TagLibConfig): Promise<EnhancedTagLib> {
    // Current implementation
    throw new Error("Not implemented");
  }

  /**
   * Open file with flexible input types
   */
  openFile(input: AudioInput): EnhancedAudioFile {
    if (typeof input === 'string') {
      return this.openFileFromPath(input);
    } else if (input instanceof File) {
      return this.openFileFromBrowserFile(input);
    } else if (input instanceof ArrayBuffer) {
      return this.openFileFromBuffer(new Uint8Array(input));
    } else if (Buffer && Buffer.isBuffer(input)) {
      return this.openFileFromBuffer(new Uint8Array(input));
    } else {
      return this.openFileFromBuffer(input);
    }
  }

  /**
   * Async file opening with callback pattern
   */
  openFileAsync(input: AudioInput, callback: TagLibCallback<EnhancedAudioFile>): void {
    try {
      const file = this.openFile(input);
      callback(null, file);
    } catch (error) {
      const tagLibError: TagLibError = {
        name: 'TagLibError',
        message: error.message,
        code: 'INVALID_FORMAT',
        details: error.stack,
      };
      callback(tagLibError);
    }
  }

  /**
   * Sync file opening (Node.js/Bun/Deno only)
   */
  openFileSync(path: string): EnhancedAudioFile {
    // Runtime-specific implementation
    if (typeof Deno !== 'undefined') {
      const data = Deno.readFileSync(path);
      return this.openFileFromBuffer(data);
    } else if (typeof Bun !== 'undefined') {
      const file = Bun.file(path);
      const data = new Uint8Array(file.arrayBufferSync());
      return this.openFileFromBuffer(data);
    } else if (typeof require !== 'undefined') {
      const fs = require('fs');
      const data = fs.readFileSync(path);
      return this.openFileFromBuffer(new Uint8Array(data));
    } else {
      throw new Error('Synchronous file reading not supported in browser environment');
    }
  }

  private openFileFromPath(path: string): EnhancedAudioFile {
    throw new Error("Not implemented");
  }

  private openFileFromBrowserFile(file: File): EnhancedAudioFile {
    throw new Error("Not implemented - requires async operation");
  }

  private openFileFromBuffer(buffer: Uint8Array): EnhancedAudioFile {
    throw new Error("Not implemented");
  }
}

/**
 * Enhanced AudioFile with property accessors and better error handling
 */
export class EnhancedAudioFile {
  // Property accessors (more intuitive than method calls)
  get title(): string | undefined {
    return this.tag().title;
  }

  set title(value: string | undefined) {
    if (value !== undefined) {
      this.setTitle(value);
    }
  }

  get artist(): string | undefined {
    return this.tag().artist;
  }

  set artist(value: string | undefined) {
    if (value !== undefined) {
      this.setArtist(value);
    }
  }

  get album(): string | undefined {
    return this.tag().album;
  }

  set album(value: string | undefined) {
    if (value !== undefined) {
      this.setAlbum(value);
    }
  }

  // Async operations with callbacks
  tagAsync(callback: TagLibCallback<any>): void {
    try {
      const tags = this.tag();
      callback(null, tags);
    } catch (error) {
      const tagLibError: TagLibError = {
        name: 'TagLibError',
        message: error.message,
        code: 'MEMORY_ERROR',
      };
      callback(tagLibError);
    }
  }

  saveAsync(callback: TagLibCallback<boolean>): void {
    try {
      const result = this.save();
      callback(null, result);
    } catch (error) {
      const tagLibError: TagLibError = {
        name: 'TagLibError', 
        message: error.message,
        code: 'PERMISSION_DENIED',
      };
      callback(tagLibError);
    }
  }

  // Bulk tag setting (convenience method)
  setTags(tags: {
    title?: string;
    artist?: string;
    album?: string;
    year?: number;
    genre?: string;
    track?: number;
    comment?: string;
  }): void {
    Object.entries(tags).forEach(([key, value]) => {
      if (value !== undefined) {
        (this as any)[key] = value;
      }
    });
  }

  // Enhanced error handling for save operations
  saveWithValidation(): { success: boolean; errors: TagLibError[] } {
    const errors: TagLibError[] = [];
    
    try {
      // Validate before saving
      if (!this.isValid()) {
        errors.push({
          name: 'TagLibError',
          message: 'File is not valid for writing',
          code: 'INVALID_FORMAT',
        });
      }

      const success = this.save();
      return { success, errors };
    } catch (error) {
      errors.push({
        name: 'TagLibError',
        message: error.message,
        code: 'PERMISSION_DENIED',
      });
      return { success: false, errors };
    }
  }

  // Method stubs (would delegate to existing implementation)
  private tag(): any { throw new Error("Not implemented"); }
  private setTitle(title: string): void { throw new Error("Not implemented"); }
  private setArtist(artist: string): void { throw new Error("Not implemented"); }
  private setAlbum(album: string): void { throw new Error("Not implemented"); }
  private save(): boolean { throw new Error("Not implemented"); }
  private isValid(): boolean { throw new Error("Not implemented"); }
}

/**
 * Usage examples demonstrating enhanced API
 */
export function demonstrateEnhancedAPI() {
  // Example 1: Property-based access
  const file = new EnhancedAudioFile();
  file.title = "New Song";
  file.artist = "New Artist";
  console.log(`${file.artist} - ${file.title}`);

  // Example 2: Bulk tag setting
  file.setTags({
    title: "Song Title",
    artist: "Artist Name",
    album: "Album Name",
    year: 2024,
  });

  // Example 3: Enhanced error handling
  const result = file.saveWithValidation();
  if (!result.success) {
    result.errors.forEach(error => {
      console.error(`Error ${error.code}: ${error.message}`);
    });
  }

  // Example 4: Callback-style async operations
  file.tagAsync((err, tags) => {
    if (err) {
      console.error(`Failed to read tags: ${err.message}`);
      return;
    }
    console.log('Tags:', tags);
  });
}