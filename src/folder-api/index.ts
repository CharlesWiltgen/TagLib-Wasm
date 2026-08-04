/**
 * Batch folder operations for TagLib-Wasm
 * Provides APIs for scanning directories and processing multiple audio files
 */

export type {
  AudioDynamics,
  AudioFileMetadata,
  DuplicateGroup,
  FolderScanItem,
  FolderScanOptions,
  FolderScanResult,
  FolderUpdateItem,
  FolderUpdateResult,
} from "./types.ts";

export { scanFolder } from "./scan-operations.ts";

export {
  exportFolderMetadata,
  findDuplicates,
  updateFolderTags,
} from "./folder-operations.ts";

export {
  type AlbumDisc,
  type AlbumGroup,
  type AlbumGroupingResult,
  type AlbumGroupItem,
  type AlbumGroupKey,
  type DiscConfidence,
  type DiscFolderInfo,
  discFolderInfo,
  groupAlbums,
  type GroupAlbumsOptions,
} from "./group-albums.ts";

export { scanForAlbums, type ScanForAlbumsOptions } from "./scan-for-albums.ts";
