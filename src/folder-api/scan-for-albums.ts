/**
 * @fileoverview Thin async wrapper: scan a folder, then group the scan into
 * albums. Deno/Node/Bun only, like scanFolder — groupAlbums itself is pure
 * and runtime-agnostic.
 */

import type { FolderScanOptions } from "./types.ts";
import { scanFolder } from "./scan-operations.ts";
import {
  type AlbumGroupingResult,
  groupAlbums,
  type GroupAlbumsOptions,
} from "./group-albums.ts";

export type ScanForAlbumsOptions = FolderScanOptions & GroupAlbumsOptions;

/**
 * Scan a folder and group the result into albums with disc subdivisions.
 *
 * Forwards every {@link FolderScanOptions} (recursive, extensions, maxFiles,
 * onProgress, includeProperties, continueOnError, criteria, signal) to the
 * scan; grouping options (minFolderConfidence, flatDiscPrefixes,
 * folderFallback) apply to {@link groupAlbums}.
 *
 * @throws the same errors scanFolder throws (permission, missing path, abort).
 */
export async function scanForAlbums(
  folderPath: string,
  options: ScanForAlbumsOptions = {},
): Promise<AlbumGroupingResult> {
  const {
    minFolderConfidence,
    flatDiscPrefixes,
    folderFallback,
    ...scanOptions
  } = options;
  const scan = await scanFolder(folderPath, scanOptions);
  return groupAlbums(scan, {
    minFolderConfidence,
    flatDiscPrefixes,
    folderFallback,
    scanRoot: folderPath,
  });
}
