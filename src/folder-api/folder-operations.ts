/**
 * Folder-level operations: duplicates, metadata export
 */

import type { Tag } from "../simple/index.ts";
import { writeFileData } from "../utils/write.ts";
import { scanFolder } from "./scan-operations.ts";
import type {
  AudioFileMetadata,
  DuplicateGroup,
  FolderScanOptions,
} from "./types.ts";

function buildCriteriaKey(
  tags: Tag,
  criteria: Array<keyof Tag>,
): { record: Record<string, string>; key: string } | null {
  const record: Record<string, string> = {};
  for (const field of criteria) {
    const val = tags[field];
    const strVal = Array.isArray(val) ? val.join(", ") : String(val ?? "");
    if (strVal) record[field] = strVal;
  }
  if (Object.keys(record).length === 0) return null;
  const key = criteria.map((f) => record[f] ?? "").join("\0");
  return { record, key };
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
  scanOptions.signal?.throwIfAborted();
  const groupMap = new Map<
    string,
    { criteria: Record<string, string>; files: AudioFileMetadata[] }
  >();

  for (const item of result.items) {
    if (item.status !== "ok") continue;
    const entry = buildCriteriaKey(item.tags, criteria);
    if (!entry) continue;

    const existing = groupMap.get(entry.key);
    if (existing) {
      existing.files.push(item);
    } else {
      groupMap.set(entry.key, { criteria: entry.record, files: [item] });
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
