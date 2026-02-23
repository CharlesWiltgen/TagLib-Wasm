/**
 * @fileoverview High-level MessagePack utilities for common TagLib-Wasm operations
 */

import { MetadataError } from "../errors/classes.ts";
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
 * High-level MessagePack utilities for common TagLib-Wasm operations
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
      throw new MetadataError("read", `Failed to convert to JSON: ${error}`);
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
      throw new MetadataError("write", `Failed to convert from JSON: ${error}`);
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

    if ("title" in obj || "artist" in obj || "album" in obj) {
      return true;
    }

    if ("bitrate" in obj && "sampleRate" in obj) {
      return true;
    }

    if ("mimeType" in obj && "data" in obj) {
      return true;
    }

    return false;
  }
}
