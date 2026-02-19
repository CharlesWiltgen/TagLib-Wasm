/**
 * @fileoverview Configurable MessagePack processor with validation and metrics
 */

import { InvalidFormatError, MemoryError } from "../errors/classes.ts";
import type { ExtendedTag } from "../types.ts";

import { decodeMessagePackAuto, isValidMessagePack } from "./decoder.ts";

import { encodeTagData } from "./encoder.ts";

/**
 * Create a MessagePack processor with custom configuration
 */
export function createMessagePackProcessor(options: {
  validateInput?: boolean;
  enableMetrics?: boolean;
  maxBufferSize?: number;
} = {}): {
  decode(buffer: Uint8Array): unknown;
  encode(data: ExtendedTag): Uint8Array;
} {
  const {
    validateInput = true,
    enableMetrics = false,
    maxBufferSize = 50 * 1024 * 1024, // 50MB
  } = options;

  return {
    decode(buffer: Uint8Array) {
      if (buffer.length > maxBufferSize) {
        throw new MemoryError(
          `Buffer exceeds maximum size: ${buffer.length} bytes (max: ${maxBufferSize})`,
        );
      }

      if (validateInput && !isValidMessagePack(buffer)) {
        throw new InvalidFormatError("Invalid MessagePack data");
      }

      const startTime = enableMetrics ? performance.now() : 0;
      const result = decodeMessagePackAuto(buffer);
      const endTime = enableMetrics ? performance.now() : 0;

      if (enableMetrics) {
        console.log(`MessagePack decode took ${endTime - startTime}ms`);
      }

      return result;
    },

    encode(data: ExtendedTag) {
      const startTime = enableMetrics ? performance.now() : 0;
      const result = encodeTagData(data);
      const endTime = enableMetrics ? performance.now() : 0;

      if (result.length > maxBufferSize) {
        throw new MemoryError(
          `Buffer exceeds maximum size: ${result.length} bytes (max: ${maxBufferSize})`,
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
