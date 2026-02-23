/**
 * @fileoverview MessagePack integration for TagLib-Wasm
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

// Re-export utilities
export { MessagePackUtils } from "./utils.ts";

// Re-export processor
export {
  createMessagePackProcessor,
  debugMessagePackProcessor,
  defaultMessagePackProcessor,
  performanceMessagePackProcessor,
} from "./processor.ts";
