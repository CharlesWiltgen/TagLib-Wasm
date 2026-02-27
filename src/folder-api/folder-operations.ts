/**
 * Folder-level operations: batch updates, duplicates, metadata export
 */

import type { TagInput } from "../simple/index.ts";
import { writeTagsToFile } from "../simple/index.ts";
import { writeFileData } from "../utils/write.ts";
import { processBatch } from "./file-processors.ts";
import { scanFolder } from "./scan-operations.ts";
import type {
  AudioFileMetadata,
  DuplicateGroup,
  FolderScanOptions,
  FolderUpdateItem,
  FolderUpdateResult,
} from "./types.ts";
import { EMPTY_TAG } from "./types.ts";

/**
 * Update metadata for multiple files in a folder
 *
 * @param updates - Array of objects containing path and tags to update
 * @param options - Update options
 * @returns Results of the update operation
 *
 * @example
 * ```typescript
 * const updates = [
 *   { path: "/music/song1.mp3", tags: { artist: "New Artist" } },
 *   { path: "/music/song2.mp3", tags: { album: "New Album" } }
 * ];
 *
 * const result = await updateFolderTags(updates);
 * console.log(`Updated ${result.successful} files`);
 * ```
 */
export async function updateFolderTags(
  updates: Array<{ path: string; tags: Partial<TagInput> }>,
  options: {
    continueOnError?: boolean;
    concurrency?: number;
    signal?: AbortSignal;
  } = {},
): Promise<FolderUpdateResult> {
  const startTime = Date.now();
  const { continueOnError = true, concurrency = 4, signal } = options;
  const items: FolderUpdateItem[] = [];

  const batchSize = concurrency * 10;
  for (let i = 0; i < updates.length; i += batchSize) {
    signal?.throwIfAborted();
    const batch = updates.slice(i, Math.min(i + batchSize, updates.length));
    const updateMap = new Map(batch.map((u) => [u.path, u]));
    await processBatch(
      batch.map((u) => u.path),
      async (path) => {
        const update = updateMap.get(path)!;
        try {
          await writeTagsToFile(update.path, update.tags);
          items.push({ status: "ok", path: update.path });
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          if (continueOnError) {
            items.push({ status: "error", path: update.path, error: err });
          } else {
            throw err;
          }
        }
        return { path, tags: EMPTY_TAG };
      },
      concurrency,
    );
  }

  return { items, duration: Date.now() - startTime };
}

/**
 * Find duplicate audio files based on metadata
 *
 * @param folderPath - Path to scan for duplicates
 * @param options - Scan options (includes `criteria` for which fields to compare)
 * @returns Groups of potential duplicate files
 */
export async function findDuplicates(
  folderPath: string,
  options?: FolderScanOptions,
): Promise<DuplicateGroup[]> {
  const { criteria = ["artist", "title"], ...scanOptions } = options ?? {};
  const result = await scanFolder(folderPath, scanOptions);
  const groupMap = new Map<
    string,
    { criteria: Record<string, string>; files: AudioFileMetadata[] }
  >();

  for (const item of result.items) {
    if (item.status !== "ok") continue;
    const criteriaRecord: Record<string, string> = {};
    for (const field of criteria) {
      const val = item.tags[field];
      const strVal = Array.isArray(val) ? val.join(", ") : String(val ?? "");
      if (strVal) criteriaRecord[field] = strVal;
    }
    const key = criteria.map((f) => criteriaRecord[f] ?? "").join("\0");

    if (Object.keys(criteriaRecord).length > 0) {
      const existing = groupMap.get(key);
      if (existing) {
        existing.files.push(item);
      } else {
        groupMap.set(key, { criteria: criteriaRecord, files: [item] });
      }
    }
  }

  return Array.from(groupMap.values()).filter((g) => g.files.length >= 2);
}

/**
 * Export metadata from a folder to JSON
 *
 * @param folderPath - Path to scan
 * @param outputPath - Where to save the JSON file
 * @param options - Scan options
 */
export async function exportFolderMetadata(
  folderPath: string,
  outputPath: string,
  options?: FolderScanOptions,
): Promise<void> {
  const result = await scanFolder(folderPath, options);

  const okItems = result.items.filter((item) => item.status === "ok");
  const errorItems = result.items.filter((item) => item.status === "error");
  const data = {
    folder: folderPath,
    scanDate: new Date().toISOString(),
    summary: {
      totalFiles: result.items.length,
      processedFiles: okItems.length,
      errors: errorItems.length,
      duration: result.duration,
    },
    files: okItems,
    errors: errorItems,
  };

  const jsonBytes = new TextEncoder().encode(JSON.stringify(data, null, 2));
  await writeFileData(outputPath, jsonBytes);
}
