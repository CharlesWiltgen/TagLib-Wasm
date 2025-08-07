/**
 * @fileoverview Type definitions for MessagePack operations
 *
 * Defines types specific to MessagePack encoding/decoding operations
 * and provides utilities for working with binary MessagePack data.
 */

/**
 * MessagePack binary data type
 */
export type MessagePackData = Uint8Array;

/**
 * Supported data types for MessagePack encoding/decoding
 */
export type MessagePackValue =
  | null
  | boolean
  | number
  | string
  | Uint8Array
  | MessagePackValue[]
  | { [key: string]: MessagePackValue };

/**
 * MessagePack decoding result with type information
 */
export interface DecodingResult<T = unknown> {
  /** The decoded data */
  data: T;
  /** Number of bytes consumed from the input */
  bytesConsumed: number;
  /** Detected data type */
  type: MessagePackDataType;
  /** Whether the decoding was successful */
  success: boolean;
  /** Error message if decoding failed */
  error?: string;
}

/**
 * MessagePack encoding result with performance metrics
 */
export interface EncodingResult {
  /** The encoded MessagePack data */
  data: MessagePackData;
  /** Size of the encoded data in bytes */
  size: number;
  /** Estimated compression ratio vs JSON */
  compressionRatio: number;
  /** Whether the encoding was successful */
  success: boolean;
  /** Error message if encoding failed */
  error?: string;
}

/**
 * Data types that can be detected in MessagePack data
 */
export type MessagePackDataType =
  | "array"
  | "map"
  | "string"
  | "binary"
  | "number"
  | "boolean"
  | "null"
  | "extension"
  | "unknown";

/**
 * Performance metrics for MessagePack operations
 */
export interface MessagePackMetrics {
  /** Encoding time in milliseconds */
  encodeTime?: number;
  /** Decoding time in milliseconds */
  decodeTime?: number;
  /** Original data size in bytes */
  originalSize: number;
  /** MessagePack data size in bytes */
  messagePackSize: number;
  /** JSON equivalent size in bytes (for comparison) */
  jsonSize: number;
  /** Size reduction percentage compared to JSON */
  sizeReduction: number;
  /** Speed improvement factor compared to JSON */
  speedImprovement: number;
}

/**
 * Batch processing result for multiple MessagePack operations
 */
export interface BatchProcessingResult<T = unknown> {
  /** Successfully processed items */
  successful: T[];
  /** Failed items with error information */
  failed: Array<{
    index: number;
    data: unknown;
    error: string;
  }>;
  /** Overall success rate */
  successRate: number;
  /** Total processing time in milliseconds */
  totalTime: number;
  /** Average time per item in milliseconds */
  averageTime: number;
}

/**
 * Configuration for MessagePack streaming operations
 */
export interface StreamingConfig {
  /** Buffer size for streaming operations */
  bufferSize: number;
  /** Maximum number of items to process in a batch */
  batchSize: number;
  /** Whether to validate each item before processing */
  validateItems: boolean;
  /** Maximum time to spend on a single item (milliseconds) */
  itemTimeout: number;
}

/**
 * MessagePack data validation result
 */
export interface ValidationResult {
  /** Whether the data is valid MessagePack */
  isValid: boolean;
  /** Detected data type */
  dataType: MessagePackDataType;
  /** Size of the data in bytes */
  size: number;
  /** Estimated decode time in milliseconds */
  estimatedDecodeTime: number;
  /** Any validation warnings */
  warnings: string[];
  /** Error message if invalid */
  error?: string;
}

/**
 * TagLib-specific MessagePack format markers
 */
export const TAGLIB_MSGPACK_MARKERS = {
  /** Marker for tag metadata */
  TAG_DATA: 0x01,
  /** Marker for audio properties */
  AUDIO_PROPERTIES: 0x02,
  /** Marker for picture/album art data */
  PICTURE_DATA: 0x03,
  /** Marker for property map data */
  PROPERTY_MAP: 0x04,
  /** Marker for batch/array data */
  BATCH_DATA: 0x05,
  /** Marker for streaming data chunk */
  STREAM_CHUNK: 0x06,
  /** Marker for error response */
  ERROR_RESPONSE: 0xFF,
} as const;

/**
 * Type for TagLib MessagePack format markers
 */
export type TagLibMessagePackMarker =
  typeof TAGLIB_MSGPACK_MARKERS[keyof typeof TAGLIB_MSGPACK_MARKERS];

/**
 * MessagePack format version information
 */
export interface FormatVersion {
  /** Major version number */
  major: number;
  /** Minor version number */
  minor: number;
  /** Patch version number */
  patch: number;
  /** Whether this version is compatible with the current implementation */
  compatible: boolean;
}

/**
 * Extended MessagePack data with TagLib-specific metadata
 */
export interface TagLibMessagePackData {
  /** Format version */
  version: FormatVersion;
  /** Data type marker */
  marker: TagLibMessagePackMarker;
  /** Timestamp when data was encoded */
  timestamp: number;
  /** The actual MessagePack data */
  data: MessagePackData;
  /** Checksum for data integrity */
  checksum?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Performance comparison between encoding formats
 */
export interface FormatComparison {
  /** Format name */
  format: "messagepack" | "json" | "binary";
  /** Encoding size in bytes */
  size: number;
  /** Encoding time in milliseconds */
  encodeTime: number;
  /** Decoding time in milliseconds */
  decodeTime: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Relative efficiency score (higher is better) */
  efficiency: number;
}

/**
 * Error types that can occur during MessagePack operations
 */
export type MessagePackError =
  | "DECODE_ERROR"
  | "ENCODE_ERROR"
  | "INVALID_DATA"
  | "BUFFER_OVERFLOW"
  | "TIMEOUT_ERROR"
  | "VALIDATION_ERROR"
  | "FORMAT_ERROR"
  | "MEMORY_ERROR";

/**
 * Detailed error information for MessagePack operations
 */
export interface MessagePackErrorInfo {
  /** Error type */
  type: MessagePackError;
  /** Human-readable error message */
  message: string;
  /** Error code (if applicable) */
  code?: number;
  /** Byte offset where error occurred */
  offset?: number;
  /** Additional context about the error */
  context?: Record<string, unknown>;
  /** Stack trace (in development) */
  stack?: string;
}

/**
 * Utility type for MessagePack-compatible objects
 */
export type MessagePackCompatible<T> = {
  [K in keyof T]: T[K] extends object ? T[K] extends Uint8Array | Date ? T[K]
    : MessagePackCompatible<T[K]>
    : T[K] extends undefined ? never
    : T[K];
};

/**
 * Configuration for automatic type detection
 */
export interface AutoDetectionConfig {
  /** Whether to detect tag data structures */
  detectTags: boolean;
  /** Whether to detect audio properties */
  detectAudioProperties: boolean;
  /** Whether to detect picture data */
  detectPictures: boolean;
  /** Whether to detect property maps */
  detectPropertyMaps: boolean;
  /** Confidence threshold for type detection (0-1) */
  confidenceThreshold: number;
}

/**
 * Result of automatic type detection
 */
export interface AutoDetectionResult {
  /** Most likely data type */
  detectedType:
    | "tag"
    | "audio-properties"
    | "picture"
    | "property-map"
    | "unknown";
  /** Confidence score (0-1) */
  confidence: number;
  /** Alternative possible types with their confidence scores */
  alternatives: Array<{
    type: string;
    confidence: number;
  }>;
  /** Fields that led to the detection */
  detectionClues: string[];
}
