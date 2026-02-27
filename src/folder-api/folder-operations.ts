/**
 * Folder-level operations: batch updates, duplicates, metadata export
 */

import type { TagInput } from "../simple/index.ts";
import { writeTagsToFile } from "../simple/index.ts";
import { writeFileData } from "../utils/write.ts";
import { processBatch } from "./file-processors.ts";
import { scanFolder } from "./scan-operations.ts";
import type { AudioFileMetadata, FolderScanOptions } from "./types.ts";
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
  options: { continueOnError?: boolean; concurrency?: number } = {},
): Promise<{
  successful: number;
  failed: Array<{ path: string; error: Error }>;
  duration: number;
}> {
  const startTime = Date.now();
  const { continueOnError = true, concurrency = 4 } = options;

  let successful = 0;
  const failed: Array<{ path: string; error: Error }> = [];

  const processor = async (
    update: { path: string; tags: Partial<TagInput> },
  ) => {
    try {
      await writeTagsToFile(update.path, update.tags);
      successful++;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (continueOnError) {
        failed.push({ path: update.path, error: err });
      } else {
        throw err;
      }
    }
  };

  const batchSize = concurrency * 10;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, Math.min(i + batchSize, updates.length));
    await processBatch(
      batch.map((u) => u.path),
      async (path) => {
        const update = batch.find((u) => u.path === path)!;
        await processor(update);
        return { path, tags: EMPTY_TAG };
      },
      concurrency,
    );
  }

  return {
    successful,
    failed,
    duration: Date.now() - startTime,
  };
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
): Promise<Map<string, AudioFileMetadata[]>> {
  const { criteria = ["artist", "title"], ...scanOptions } = options ?? {};
  const result = await scanFolder(folderPath, scanOptions);
  const duplicates = new Map<string, AudioFileMetadata[]>();

  for (const item of result.items) {
    if (item.status !== "ok") continue;
    const key = criteria
      .map((field) => {
        const val = item.tags[field];
        if (Array.isArray(val)) return val.join(", ");
        return val ?? "";
      })
      .filter((v) => v !== "")
      .join("|");

    if (key) {
      const group = duplicates.get(key) ?? [];
      group.push(item);
      duplicates.set(key, group);
    }
  }

  for (const [key, files] of duplicates.entries()) {
    if (files.length < 2) {
      duplicates.delete(key);
    }
  }

  return duplicates;
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
