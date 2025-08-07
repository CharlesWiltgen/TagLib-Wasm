/**
 * @fileoverview MessagePack integration for taglib-wasm
 *
 * Provides high-performance binary serialization for audio metadata,
 * offering 10x faster processing and 50% smaller payloads compared to JSON.
 *
 * This module integrates with the Phase 2.5 C API that outputs MessagePack
 * data directly from TagLib operations.
 *
 * @example
 * ```typescript
 * import { decodeTagData, encodeTagData } from "./msgpack/index.ts";
 *
 * // Decode MessagePack data from C API
 * const tagData = decodeTagData(msgpackBuffer);
 * console.log(tagData.title, tagData.artist);
 *
 * // Encode tag data for writing back
 * const encoded = encodeTagData(modifiedTags);
 * ```
 */

// Re-export all decoder functions
export {
  decodeAudioProperties,
  decodeFastTagData,
  decodeMessagePack,
  decodeMessagePackAuto,
  decodePicture,
  decodePictureArray,
  decodePropertyMap,
  decodeTagData,
  getMessagePackInfo,
  isValidMessagePack,
} from "./decoder.ts";

// Re-export all encoder functions
export {
  canEncodeToMessagePack,
  compareEncodingEfficiency,
  encodeAudioProperties,
  encodeBatchTagData,
  encodeFastTagData,
  encodeMessagePack,
  encodeMessagePackCompact,
  encodeMessagePackStream,
  encodePicture,
  encodePictureArray,
  encodePropertyMap,
  encodeTagData,
  estimateMessagePackSize,
} from "./encoder.ts";

// Re-export all types
export type {
  AutoDetectionConfig,
  AutoDetectionResult,
  BatchProcessingResult,
  DecodingResult,
  EncodingResult,
  FormatComparison,
  FormatVersion,
  MessagePackCompatible,
  MessagePackData,
  MessagePackDataType,
  MessagePackError,
  MessagePackErrorInfo,
  MessagePackMetrics,
  MessagePackValue,
  StreamingConfig,
  TagLibMessagePackData,
  TagLibMessagePackMarker,
  ValidationResult,
} from "./types.ts";

// Re-export constants
export { TAGLIB_MSGPACK_MARKERS } from "./types.ts";

import type { AudioProperties, ExtendedTag, Picture } from "../types.ts";

import {
  decodeAudioProperties,
  decodeMessagePackAuto,
  decodePicture,
  decodeTagData,
  isValidMessagePack,
} from "./decoder.ts";

import { compareEncodingEfficiency, encodeTagData } from "./encoder.ts";

/**
 * High-level MessagePack utilities for common taglib-wasm operations
 */
export class MessagePackUtils {
  /**
   * Smart decode that automatically detects the data type
   */
  static decode(
    buffer: Uint8Array,
  ): ExtendedTag | AudioProperties | Picture | unknown {
    return decodeMessagePackAuto(buffer);
  }

  /**
   * Validate and decode tag data with error handling
   */
  static safeDecodeTagData(buffer: Uint8Array): ExtendedTag | null {
    try {
      if (!isValidMessagePack(buffer)) {
        return null;
      }
      return decodeTagData(buffer);
    } catch {
      return null;
    }
  }

  /**
   * Validate and decode audio properties with error handling
   */
  static safeDecodeAudioProperties(buffer: Uint8Array): AudioProperties | null {
    try {
      if (!isValidMessagePack(buffer)) {
        return null;
      }
      return decodeAudioProperties(buffer);
    } catch {
      return null;
    }
  }

  /**
   * Validate and decode picture data with error handling
   */
  static safeDecodePicture(buffer: Uint8Array): Picture | null {
    try {
      if (!isValidMessagePack(buffer)) {
        return null;
      }
      return decodePicture(buffer);
    } catch {
      return null;
    }
  }

  /**
   * Get performance metrics for MessagePack vs JSON
   */
  static getPerformanceComparison(data: ExtendedTag): {
    messagePackSize: number;
    jsonSize: number;
    sizeReduction: number;
    estimatedSpeedImprovement: number;
  } {
    const comparison = compareEncodingEfficiency(data);
    return {
      messagePackSize: comparison.messagePackSize,
      jsonSize: comparison.jsonSize,
      sizeReduction: comparison.sizeReduction,
      estimatedSpeedImprovement: comparison.speedImprovement,
    };
  }

  /**
   * Convert between MessagePack and JSON for debugging/comparison
   */
  static toJson(buffer: Uint8Array): string {
    try {
      const decoded = decodeMessagePackAuto(buffer);
      return JSON.stringify(decoded, null, 2);
    } catch (error) {
      throw new Error(`Failed to convert MessagePack to JSON: ${error}`);
    }
  }

  /**
   * Convert JSON back to MessagePack (for testing/migration)
   */
  static fromJson(jsonString: string): Uint8Array {
    try {
      const data = JSON.parse(jsonString);
      return encodeTagData(data);
    } catch (error) {
      throw new Error(`Failed to convert JSON to MessagePack: ${error}`);
    }
  }

  /**
   * Batch process multiple MessagePack buffers
   */
  static batchDecode(buffers: Uint8Array[]): Array<{
    success: boolean;
    data?: ExtendedTag | AudioProperties | Picture | unknown;
    error?: string;
  }> {
    return buffers.map((buffer) => {
      try {
        const data = decodeMessagePackAuto(buffer);
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });
  }

  /**
   * Check if data is compatible with TagLib MessagePack format
   */
  static isTagLibCompatible(data: unknown): boolean {
    if (typeof data !== "object" || data === null) {
      return false;
    }

    const obj = data as Record<string, unknown>;

    // Check for tag data structure
    if ("title" in obj || "artist" in obj || "album" in obj) {
      return true;
    }

    // Check for audio properties structure
    if ("bitrate" in obj && "sampleRate" in obj) {
      return true;
    }

    // Check for picture structure
    if ("mimeType" in obj && "data" in obj) {
      return true;
    }

    return false;
  }
}

/**
 * Create a MessagePack processor with custom configuration
 */
export function createMessagePackProcessor(options: {
  validateInput?: boolean;
  enableMetrics?: boolean;
  maxBufferSize?: number;
} = {}) {
  const {
    validateInput = true,
    enableMetrics = false,
    maxBufferSize = 50 * 1024 * 1024, // 50MB
  } = options;

  return {
    /**
     * Decode with optional validation and metrics
     */
    decode(buffer: Uint8Array) {
      if (buffer.length > maxBufferSize) {
        throw new Error(
          `Buffer too large: ${buffer.length} bytes (max: ${maxBufferSize})`,
        );
      }

      if (validateInput && !isValidMessagePack(buffer)) {
        throw new Error("Invalid MessagePack data");
      }

      const startTime = enableMetrics ? performance.now() : 0;
      const result = decodeMessagePackAuto(buffer);
      const endTime = enableMetrics ? performance.now() : 0;

      if (enableMetrics) {
        console.log(`MessagePack decode took ${endTime - startTime}ms`);
      }

      return result;
    },

    /**
     * Encode with optional metrics
     */
    encode(data: ExtendedTag) {
      const startTime = enableMetrics ? performance.now() : 0;
      const result = encodeTagData(data);
      const endTime = enableMetrics ? performance.now() : 0;

      if (result.length > maxBufferSize) {
        throw new Error(
          `Encoded data too large: ${result.length} bytes (max: ${maxBufferSize})`,
        );
      }

      if (enableMetrics) {
        console.log(`MessagePack encode took ${endTime - startTime}ms`);
      }

      return result;
    },
  };
}

/**
 * Default MessagePack processor instance with balanced settings
 */
export const defaultMessagePackProcessor = createMessagePackProcessor({
  validateInput: true,
  enableMetrics: false,
  maxBufferSize: 50 * 1024 * 1024, // 50MB
});

/**
 * High-performance MessagePack processor for production use
 */
export const performanceMessagePackProcessor = createMessagePackProcessor({
  validateInput: false, // Skip validation for speed
  enableMetrics: false,
  maxBufferSize: 100 * 1024 * 1024, // 100MB
});

/**
 * Debug-enabled MessagePack processor for development
 */
export const debugMessagePackProcessor = createMessagePackProcessor({
  validateInput: true,
  enableMetrics: true,
  maxBufferSize: 10 * 1024 * 1024, // 10MB
});
