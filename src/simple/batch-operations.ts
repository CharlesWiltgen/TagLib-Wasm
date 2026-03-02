import type { AudioFile } from "../taglib.ts";
import type { AudioDynamics } from "../folder-api/types.ts";
import type { AudioFileInput, AudioProperties, ExtendedTag } from "../types.ts";
import { InvalidFormatError } from "../errors.ts";
import { mapPropertiesToExtendedTag } from "../utils/tag-mapping.ts";
import { getTagLib } from "./config.ts";

/** Configuration for batch processing operations. */
export interface BatchOptions {
  concurrency?: number;
  continueOnError?: boolean;
  onProgress?: (processed: number, total: number, currentFile: string) => void;
  /** AbortSignal to cancel the batch operation between chunks. */
  signal?: AbortSignal;
}

/** Discriminated union result for a single file in a batch operation. */
export type BatchItem<T> =
  | { status: "ok"; path: string; data: T }
  | { status: "error"; path: string; error: Error };

/** Result of a batch operation containing all items and timing. */
export interface BatchResult<T> {
  items: BatchItem<T>[];
  duration: number;
}

async function executeBatch<T>(
  files: AudioFileInput[],
  options: BatchOptions,
  processor: (audioFile: AudioFile) => T,
): Promise<BatchResult<T>> {
  if (files.length === 0) return { items: [], duration: 0 };
  const startTime = Date.now();
  const { concurrency = 4, continueOnError = true, onProgress, signal } =
    options;
  const items: BatchItem<T>[] = new Array(files.length);
  const taglib = await getTagLib();
  let processed = 0;
  const total = files.length;

  for (let i = 0; i < files.length; i += concurrency) {
    signal?.throwIfAborted();
    const chunk = files.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (file, idx) => {
      const index = i + idx;
      const fileName = typeof file === "string" ? file : `file-${index}`;
      try {
        const audioFile = await taglib.open(file);
        try {
          if (!audioFile.isValid()) {
            throw new InvalidFormatError(
              "File may be corrupted or in an unsupported format",
            );
          }
          items[index] = {
            status: "ok",
            path: fileName,
            data: processor(audioFile),
          };
        } finally {
          audioFile.dispose();
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        items[index] = { status: "error", path: fileName, error: err };
        if (!continueOnError) throw err;
      }
      processed++;
      onProgress?.(processed, total, fileName);
    });
    await Promise.all(chunkPromises);
  }
  return { items, duration: Date.now() - startTime };
}

/**
 * Read tags from multiple files with configurable concurrency.
 *
 * @param files - Array of file paths, Uint8Arrays, ArrayBuffers, or File objects.
 * @param options - Batch processing options (concurrency, error handling, progress).
 * @returns Batch result containing a `BatchItem` per file and total duration in ms.
 * @throws If `continueOnError` is `false` and any file fails to process.
 */
export async function readTagsBatch(
  files: AudioFileInput[],
  options: BatchOptions = {},
): Promise<BatchResult<ExtendedTag>> {
  return executeBatch(
    files,
    options,
    (audioFile) => mapPropertiesToExtendedTag(audioFile.properties()),
  );
}

/**
 * Read audio properties from multiple files with configurable concurrency.
 *
 * @param files - Array of file paths, Uint8Arrays, ArrayBuffers, or File objects.
 * @param options - Batch processing options (concurrency, error handling, progress).
 * @returns Batch result containing a `BatchItem` per file and total duration in ms.
 * @throws If `continueOnError` is `false` and any file fails to process.
 */
export async function readPropertiesBatch(
  files: AudioFileInput[],
  options: BatchOptions = {},
): Promise<BatchResult<AudioProperties | undefined>> {
  return executeBatch(
    files,
    options,
    (audioFile) => audioFile.audioProperties(),
  );
}

/** Complete metadata for a single audio file including tags, properties, cover art presence, and audio dynamics. */
export interface FileMetadata {
  tags: ExtendedTag;
  properties: AudioProperties | undefined;
  hasCoverArt: boolean;
  dynamics?: AudioDynamics;
}

function extractDynamics(audioFile: AudioFile): AudioDynamics | undefined {
  const dynamics: Record<string, string> = {};
  const fields = [
    "replayGainTrackGain",
    "replayGainTrackPeak",
    "replayGainAlbumGain",
    "replayGainAlbumPeak",
  ];
  for (const field of fields) {
    const val = audioFile.getProperty(field);
    if (val) dynamics[field] = val;
  }
  let appleSoundCheck = audioFile.getProperty("appleSoundCheck");
  if (!appleSoundCheck && audioFile.isMP4()) {
    appleSoundCheck = audioFile.getMP4Item("----:com.apple.iTunes:iTunNORM");
  }
  if (appleSoundCheck) dynamics.appleSoundCheck = appleSoundCheck;
  return Object.keys(dynamics).length > 0
    ? dynamics as AudioDynamics
    : undefined;
}

/**
 * Read complete metadata (tags, properties, cover art, dynamics) from a single file.
 *
 * @param file - A file path, Uint8Array, ArrayBuffer, or File object.
 * @returns The file's complete metadata.
 * @throws `InvalidFormatError` if the file is corrupted or in an unsupported format.
 */
export async function readMetadata(
  file: AudioFileInput,
): Promise<FileMetadata> {
  const taglib = await getTagLib();
  const audioFile = await taglib.open(file);
  try {
    if (!audioFile.isValid()) {
      let name: string;
      if (typeof file === "string") {
        name = file;
      } else if (file instanceof File) {
        name = file.name;
      } else {
        name = `buffer (${file.byteLength} bytes)`;
      }
      throw new InvalidFormatError(
        `File may be corrupted or in an unsupported format. File: ${name}`,
      );
    }
    return {
      tags: mapPropertiesToExtendedTag(audioFile.properties()),
      properties: audioFile.audioProperties(),
      hasCoverArt: audioFile.getPictures().length > 0,
      dynamics: extractDynamics(audioFile),
    };
  } finally {
    audioFile.dispose();
  }
}

/**
 * Read complete metadata from multiple files with configurable concurrency.
 *
 * @param files - Array of file paths, Uint8Arrays, ArrayBuffers, or File objects.
 * @param options - Batch processing options (concurrency, error handling, progress).
 * @returns Batch result containing a `BatchItem` per file and total duration in ms.
 * @throws If `continueOnError` is `false` and any file fails to process.
 */
export async function readMetadataBatch(
  files: AudioFileInput[],
  options: BatchOptions = {},
): Promise<BatchResult<FileMetadata>> {
  return executeBatch(files, options, (audioFile) => ({
    tags: mapPropertiesToExtendedTag(audioFile.properties()),
    properties: audioFile.audioProperties(),
    hasCoverArt: audioFile.getPictures().length > 0,
    dynamics: extractDynamics(audioFile),
  }));
}
