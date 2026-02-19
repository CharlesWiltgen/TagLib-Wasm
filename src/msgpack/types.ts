/** Type definitions for MessagePack encoding/decoding operations. */

export type MessagePackData = Uint8Array;

export type MessagePackValue =
  | null
  | boolean
  | number
  | string
  | Uint8Array
  | MessagePackValue[]
  | { [key: string]: MessagePackValue };

export interface DecodingResult<T = unknown> {
  data: T;
  bytesConsumed: number;
  type: MessagePackDataType;
  success: boolean;
  error?: string;
}

export interface EncodingResult {
  data: MessagePackData;
  size: number;
  compressionRatio: number;
  success: boolean;
  error?: string;
}

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

export interface MessagePackMetrics {
  encodeTime?: number;
  decodeTime?: number;
  originalSize: number;
  messagePackSize: number;
  jsonSize: number;
  sizeReduction: number;
  speedImprovement: number;
}

export interface BatchProcessingResult<T = unknown> {
  successful: T[];
  failed: Array<{
    index: number;
    data: unknown;
    error: string;
  }>;
  successRate: number;
  totalTime: number;
  averageTime: number;
}

export interface StreamingConfig {
  bufferSize: number;
  batchSize: number;
  validateItems: boolean;
  itemTimeout: number;
}

export interface ValidationResult {
  isValid: boolean;
  dataType: MessagePackDataType;
  size: number;
  estimatedDecodeTime: number;
  warnings: string[];
  error?: string;
}

/** TagLib-specific MessagePack format markers */
export const TAGLIB_MSGPACK_MARKERS = {
  TAG_DATA: 0x01,
  AUDIO_PROPERTIES: 0x02,
  PICTURE_DATA: 0x03,
  PROPERTY_MAP: 0x04,
  BATCH_DATA: 0x05,
  STREAM_CHUNK: 0x06,
  ERROR_RESPONSE: 0xFF,
} as const;

export type TagLibMessagePackMarker =
  typeof TAGLIB_MSGPACK_MARKERS[keyof typeof TAGLIB_MSGPACK_MARKERS];

export interface FormatVersion {
  major: number;
  minor: number;
  patch: number;
  compatible: boolean;
}

export interface TagLibMessagePackData {
  version: FormatVersion;
  marker: TagLibMessagePackMarker;
  timestamp: number;
  data: MessagePackData;
  checksum?: string;
  metadata?: Record<string, unknown>;
}

export interface FormatComparison {
  format: "messagepack" | "json" | "binary";
  size: number;
  encodeTime: number;
  decodeTime: number;
  memoryUsage: number;
  efficiency: number;
}

export type MessagePackError =
  | "DECODE_ERROR"
  | "ENCODE_ERROR"
  | "INVALID_DATA"
  | "BUFFER_OVERFLOW"
  | "TIMEOUT_ERROR"
  | "VALIDATION_ERROR"
  | "FORMAT_ERROR"
  | "MEMORY_ERROR";

export interface MessagePackErrorInfo {
  type: MessagePackError;
  message: string;
  code?: number;
  offset?: number;
  context?: Record<string, unknown>;
  stack?: string;
}

export type MessagePackCompatible<T> = {
  [K in keyof T]: T[K] extends object ? T[K] extends Uint8Array | Date ? T[K]
    : MessagePackCompatible<T[K]>
    : T[K] extends undefined ? never
    : T[K];
};

export interface AutoDetectionConfig {
  detectTags: boolean;
  detectAudioProperties: boolean;
  detectPictures: boolean;
  detectPropertyMaps: boolean;
  confidenceThreshold: number;
}

export interface AutoDetectionResult {
  detectedType:
    | "tag"
    | "audio-properties"
    | "picture"
    | "property-map"
    | "unknown";
  confidence: number;
  alternatives: Array<{
    type: string;
    confidence: number;
  }>;
  detectionClues: string[];
}
