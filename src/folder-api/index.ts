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
} from "./types.ts";

export { scanFolder } from "./scan-operations.ts";

export { exportFolderMetadata, findDuplicates } from "./folder-operations.ts";

export {
  type AlbumDisc,
  type AlbumGroup,
  type AlbumGroupingResult,
  type AlbumGroupItem,
  type AlbumGroupKey,
  type DiscConfidence,
  type DiscFolderInfo,
  type GroupAlbumsOptions,
} from "./album-types.ts";

export { discFolderInfo } from "./folder-disc.ts";
export { groupAlbums } from "./album-grouping.ts";

export { scanForAlbums, type ScanForAlbumsOptions } from "./scan-for-albums.ts";
