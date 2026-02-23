/**
 * Batch folder operations for TagLib-Wasm
 * Provides APIs for scanning directories and processing multiple audio files
 */

export type {
  AudioDynamics,
  AudioFileMetadata,
  FolderScanOptions,
  FolderScanResult,
} from "./types.ts";

export { scanFolder } from "./scan-operations.ts";

export {
  exportFolderMetadata,
  findDuplicates,
  updateFolderTags,
} from "./folder-operations.ts";
