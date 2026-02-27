/**
 * Scanning operations for folder-level metadata reading
 */

import { TagLib } from "../taglib.ts";
import { getTagLib } from "../simple/config.ts";
import { walkDirectory } from "./directory-walker.ts";
import { processBatch, processFileWithTagLib } from "./file-processors.ts";
import type {
  FolderScanItem,
  FolderScanOptions,
  FolderScanResult,
  ScanProcessOptions,
} from "./types.ts";

async function scanWithTagLib(
  taglib: TagLib,
  filePaths: string[],
  opts: ScanProcessOptions,
): Promise<FolderScanItem[]> {
  const { includeProperties, continueOnError, onProgress, totalFound } = opts;
  const items: FolderScanItem[] = [];
  const progress = { count: 0 };

  const processor = async (
    filePath: string,
  ): Promise<FolderScanItem> => {
    try {
      const metadata = await processFileWithTagLib(
        filePath,
        taglib,
        includeProperties,
        onProgress,
        progress,
        totalFound,
      );
      return { status: "ok", ...metadata };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (continueOnError) {
        const current = ++progress.count;
        onProgress?.(current, totalFound, filePath);
        return { status: "error", path: filePath, error: err };
      } else {
        throw err;
      }
    }
  };

  const concurrency = 4;
  const batchSize = concurrency * 10;
  for (let i = 0; i < filePaths.length; i += batchSize) {
    const batch = filePaths.slice(
      i,
      Math.min(i + batchSize, filePaths.length),
    );
    const batchResults = await processBatch(batch, processor, concurrency);
    items.push(...batchResults);
  }

  return items;
}

/**
 * Scan a folder and read metadata from all audio files
 *
 * @param folderPath - Path to the folder to scan
 * @param options - Scanning options
 * @returns Metadata for all audio files found
 *
 * @example
 * ```typescript
 * const result = await scanFolder("/path/to/music");
 * for (const item of result.items) {
 *   if (item.status === "ok") {
 *     console.log(`${item.path}: ${item.tags.artist} - ${item.tags.title}`);
 *   }
 * }
 * ```
 */
export async function scanFolder(
  folderPath: string,
  options: FolderScanOptions = {},
): Promise<FolderScanResult> {
  const startTime = Date.now();
  const {
    maxFiles = Infinity,
    includeProperties = true,
    continueOnError = true,
    onProgress,
    forceBufferMode,
  } = options;

  const filePaths: string[] = [];

  let fileCount = 0;
  for await (const filePath of walkDirectory(folderPath, options)) {
    filePaths.push(filePath);
    fileCount++;
    if (fileCount >= maxFiles) break;
  }

  const totalFound = filePaths.length;

  const taglib = forceBufferMode
    ? await TagLib.initialize({ forceBufferMode: true })
    : await getTagLib();

  const processOpts: ScanProcessOptions = {
    includeProperties,
    continueOnError,
    onProgress,
    totalFound,
  };

  const items = await scanWithTagLib(taglib, filePaths, processOpts);

  return {
    items,
    duration: Date.now() - startTime,
  };
}
