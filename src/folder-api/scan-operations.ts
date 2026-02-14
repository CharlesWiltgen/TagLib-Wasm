/**
 * Scanning operations for folder-level metadata reading
 */

import { TagLib } from "../taglib.ts";
import {
  getGlobalWorkerPool,
  type TagLibWorkerPool,
} from "../worker-pool/index.ts";
import { walkDirectory } from "./directory-walker.ts";
import {
  processBatch,
  processFileWithTagLib,
  processFileWithWorker,
} from "./file-processors.ts";
import {
  type AudioFileMetadata,
  EMPTY_TAG,
  type FolderScanOptions,
  type FolderScanResult,
  type ScanProcessOptions,
  type ScanProcessResult,
} from "./types.ts";

async function scanWithWorkerPool(
  pool: TagLibWorkerPool,
  filePaths: string[],
  opts: ScanProcessOptions,
): Promise<ScanProcessResult> {
  const { includeProperties, continueOnError, onProgress, totalFound } = opts;
  const files: AudioFileMetadata[] = [];
  const errors: Array<{ path: string; error: Error }> = [];
  const progress = { count: 0 };
  const batchSize = Math.min(50, filePaths.length);

  for (let i = 0; i < filePaths.length; i += batchSize) {
    const batch = filePaths.slice(
      i,
      Math.min(i + batchSize, filePaths.length),
    );

    const batchPromises = batch.map(async (filePath) => {
      try {
        return await processFileWithWorker(
          filePath,
          pool,
          includeProperties,
          onProgress,
          progress,
          totalFound,
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        if (continueOnError) {
          errors.push({ path: filePath, error: err });
          const current = ++progress.count;
          onProgress?.(current, totalFound, filePath);
          return { path: filePath, tags: EMPTY_TAG, error: err };
        } else {
          throw err;
        }
      }
    });

    const batchResults = await Promise.all(batchPromises);
    files.push(...batchResults.filter((r) => !r.error));
  }

  return { files, errors, processed: progress.count };
}

async function scanWithTagLib(
  taglib: TagLib,
  filePaths: string[],
  opts: ScanProcessOptions,
): Promise<ScanProcessResult> {
  const { includeProperties, continueOnError, onProgress, totalFound } = opts;
  const files: AudioFileMetadata[] = [];
  const errors: Array<{ path: string; error: Error }> = [];
  const progress = { count: 0 };

  const processor = async (
    filePath: string,
  ): Promise<AudioFileMetadata> => {
    try {
      return await processFileWithTagLib(
        filePath,
        taglib,
        includeProperties,
        onProgress,
        progress,
        totalFound,
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (continueOnError) {
        errors.push({ path: filePath, error: err });
        const current = ++progress.count;
        onProgress?.(current, totalFound, filePath);
        return { path: filePath, tags: EMPTY_TAG, error: err };
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
    files.push(...batchResults.filter((r) => !r.error));
  }

  return { files, errors, processed: progress.count };
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
 * console.log(`Found ${result.totalFound} audio files`);
 *
 * for (const file of result.files) {
 *   console.log(`${file.path}: ${file.tags.artist} - ${file.tags.title}`);
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
    useWorkerPool = true,
    workerPool,
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

  const shouldUseWorkerPool = useWorkerPool &&
    (workerPool ?? typeof Worker !== "undefined");
  let pool: TagLibWorkerPool | null = null;

  if (shouldUseWorkerPool) {
    pool = workerPool ?? getGlobalWorkerPool();
  }

  let initOptions;
  if (forceBufferMode) {
    initOptions = { forceBufferMode: true } as const;
  }
  const taglib = shouldUseWorkerPool
    ? null
    : await TagLib.initialize(initOptions);

  const processOpts: ScanProcessOptions = {
    includeProperties,
    continueOnError,
    onProgress,
    totalFound,
  };

  const result = pool
    ? await scanWithWorkerPool(pool, filePaths, processOpts)
    : await scanWithTagLib(taglib!, filePaths, processOpts);

  return {
    files: result.files,
    errors: result.errors,
    totalFound,
    totalProcessed: result.processed,
    duration: Date.now() - startTime,
  };
}
