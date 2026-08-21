import type { AudioFile } from "../taglib.ts";
import type { AudioDynamics } from "../folder-api/types.ts";
import type {
  AudioFileInput,
  AudioProperties,
  ExtendedTag,
  TagInput,
} from "../types.ts";
import { isNamedAudioInput } from "../types/audio-formats.ts";
import { InvalidFormatError } from "../errors.ts";
import { fromTagLibKey } from "../constants/properties.ts";
import { mergeTagUpdatesInto, readExtendedTag } from "../utils/tag-mapping.ts";
import { withAudioFileSaveToFile } from "./with-audio-file.ts";
import { getTagLib } from "./config.ts";

/** Configuration for batch processing operations. */
export interface BatchOptions {
  concurrency?: number;
  continueOnError?: boolean;
  onProgress?: (processed: number, total: number, currentFile: string) => void;
  /** AbortSignal to cancel the batch operation between chunks. */
  signal?: AbortSignal;
  /**
   * Raw WIRE keys (e.g. "CATALOGNUMBER") to surface per item under
   * `extraProperties`, for keys outside the modeled typed set (taglib-3s1f).
   * The PropertyMap is already fetched per file, so this costs no extra
   * opens on either backend. Absent keys are omitted, not empty arrays.
   */
  includeProperties?: string[];
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
  const items: BatchItem<T>[] = new Array<BatchItem<T>>(files.length);
  const taglib = await getTagLib();
  let processed = 0;
  const total = files.length;

  for (let i = 0; i < files.length; i += concurrency) {
    signal?.throwIfAborted();
    const chunk = files.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (file, idx) => {
      const index = i + idx;
      const fileName = typeof file === "string"
        ? file
        : file instanceof File
        ? file.name
        : isNamedAudioInput(file)
        ? file.name
        : `buffer-${index}`;
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
 * @param files - Array of file paths, Uint8Arrays, ArrayBuffers, File objects, or NamedAudioInputs.
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
    (audioFile) => readExtendedTag(audioFile, options.includeProperties),
  );
}

/**
 * Read audio properties from multiple files with configurable concurrency.
 *
 * @param files - Array of file paths, Uint8Arrays, ArrayBuffers, File objects, or NamedAudioInputs.
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
    const val = audioFile.getProperty(field)?.[0];
    if (val !== undefined) dynamics[field] = val;
  }
  let appleSoundCheck = audioFile.getProperty("appleSoundCheck")?.[0];
  if (!appleSoundCheck && audioFile.isMP4()) {
    appleSoundCheck = audioFile.getMP4Item("----:com.apple.iTunes:iTunNORM");
  }
  if (appleSoundCheck) dynamics.appleSoundCheck = appleSoundCheck;
  return Object.keys(dynamics).length > 0 ? dynamics : undefined;
}

/**
 * Read complete metadata (tags, properties, cover art, dynamics) from a single file.
 *
 * @param file - A file path, Uint8Array, ArrayBuffer, File object, or NamedAudioInput.
 * @param options - Read options; `includeProperties` (wire keys) surfaces raw
 *   values in `tags.extraProperties` (taglib-3s1f).
 * @returns The file's complete metadata.
 * @throws `InvalidFormatError` if the file is corrupted or in an unsupported format.
 */
export async function readMetadata(
  file: AudioFileInput,
  options: { includeProperties?: string[] } = {},
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
      } else if (isNamedAudioInput(file)) {
        name = file.name;
      } else {
        name = `buffer (${file.byteLength} bytes)`;
      }
      throw new InvalidFormatError(
        `File may be corrupted or in an unsupported format. File: ${name}`,
      );
    }
    const dynamics = extractDynamics(audioFile);
    return {
      tags: readExtendedTag(audioFile, options.includeProperties),
      properties: audioFile.audioProperties(),
      hasCoverArt: audioFile.getPictures().length > 0,
      ...(dynamics !== undefined ? { dynamics } : {}),
    };
  } finally {
    audioFile.dispose();
  }
}

/**
 * Read complete metadata from multiple files with configurable concurrency.
 *
 * @param files - Array of file paths, Uint8Arrays, ArrayBuffers, File objects, or NamedAudioInputs.
 * @param options - Batch processing options (concurrency, error handling, progress).
 * @returns Batch result containing a `BatchItem` per file and total duration in ms.
 * @throws If `continueOnError` is `false` and any file fails to process.
 */
export async function readMetadataBatch(
  files: AudioFileInput[],
  options: BatchOptions = {},
): Promise<BatchResult<FileMetadata>> {
  return executeBatch(files, options, (audioFile) => {
    const dynamics = extractDynamics(audioFile);
    return {
      tags: readExtendedTag(audioFile, options.includeProperties),
      properties: audioFile.audioProperties(),
      hasCoverArt: audioFile.getPictures().length > 0,
      ...(dynamics !== undefined ? { dynamics } : {}),
    };
  });
}

/** One file to update in a {@link writeTagsBatch} call. */
export interface WriteTagUpdate {
  /** File path on disk; the file is updated in place. */
  path: string;
  /**
   * Partial typed tag fields to merge with the file's existing metadata. An
   * empty object performs a save with no tag changes (a no-op rewrite).
   */
  tags?: Partial<TagInput>;
  /**
   * Raw WIRE-key map, merged verbatim — the same shape and rule as the Full
   * API's `setProperties` (taglib-pmhp review): keys outside the typed
   * TagInput surface (barcode, unmodeled TXXX fields) ride here, and an
   * EMPTY ARRAY removes the key (the qyw2/nc5 clearing contract; no
   * empty-string carrier). Applied in the same single save as `tags`;
   * entries here take precedence over `tags` for the same normalized key.
   * Writes are verbatim: unlike the typed `tags` channel (which clears the
   * legacy YEAR field when DATE is set), a raw `properties` write does not
   * reconcile related keys — exactly like the Full API's `setProperties`.
   */
  properties?: Record<string, string[]>;
}

type WriteEntry = WriteTagUpdate | string;

function entryPath(entry: WriteEntry): string {
  return typeof entry === "string" ? entry : entry.path;
}

/**
 * Shared batch-write driver: the read-side executeBatch contract applied to
 * writes (taglib-pmhp). Per-file try/catch with ok/error items, abort between
 * chunks (never mid-save), progress after each file, input-order-preserving
 * results. Atomicity is inherited from saveToFile's temp-file save: a failed
 * file is left in its pre-write state.
 */
async function executeWriteBatch(
  entries: WriteEntry[],
  options: BatchOptions,
  writer: (path: string) => Promise<void>,
): Promise<BatchResult<void>> {
  if (entries.length === 0) return { items: [], duration: 0 };
  // Mirror executeBatch: initialize BEFORE the loop so a Wasm init failure
  // rejects the batch instead of surfacing as a per-file error item under
  // the default continueOnError.
  await getTagLib();
  const startTime = Date.now();
  const { concurrency = 4, continueOnError = true, onProgress, signal } =
    options;
  const items: BatchItem<void>[] = new Array<BatchItem<void>>(entries.length);
  let processed = 0;
  const total = entries.length;

  for (let i = 0; i < entries.length; i += concurrency) {
    signal?.throwIfAborted();
    const chunk = entries.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (entry, idx) => {
      const index = i + idx;
      const path = entryPath(entry);
      try {
        await writer(path);
        items[index] = { status: "ok", path, data: undefined };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        items[index] = { status: "error", path, error: err };
        if (!continueOnError) throw err;
      }
      processed++;
      onProgress?.(processed, total, path);
    });
    await Promise.all(chunkPromises);
  }
  return { items, duration: Date.now() - startTime };
}

/**
 * Apply tag updates to multiple files with configurable concurrency.
 *
 * The batch write counterpart to {@link readTagsBatch}: same
 * {@link BatchOptions} contract (concurrency, continueOnError, onProgress,
 * signal). Each file is updated in ONE save via a single `setProperties`
 * fold: the typed `tags` merge ({@link mergeTagUpdatesInto} — the same
 * semantics as {@link applyTagsToFile}) plus the raw wire-key `properties`
 * entries. Atomic temp-file save, so a failed file is left in its pre-write
 * state.
 *
 * @param updates - Per-file tag updates; a path may appear more than once
 *   (the last update for a path wins).
 * @param options - Batch processing options (concurrency, error handling,
 *   progress, abort).
 * @returns A `BatchItem` per update in input order plus total duration in ms.
 * @throws If `continueOnError` is `false` and any file fails to process.
 */
export async function writeTagsBatch(
  updates: WriteTagUpdate[],
  options: BatchOptions = {},
): Promise<BatchResult<void>> {
  const byPath = new Map(updates.map((u) => [u.path, u]));
  return executeWriteBatch(
    updates,
    options,
    (path) =>
      withAudioFileSaveToFile(path, (audioFile) => {
        const update = byPath.get(path)!;
        const merged = update.tags !== undefined
          ? mergeTagUpdatesInto(audioFile.properties(), update.tags)
          : audioFile.properties();
        // Raw wire-key entries fold into the SAME map so one setProperties call
        // reaches the replace-style Emscripten backend — two calls would drop
        // the first's keys there (taglib-pmhp review). The empty-array removal
        // (qyw2/nc5) is the map's own rule: `{ COMPILATION: [] }` removes the
        // key with no empty-string carrier (setProperty(key, "") leaves one).
        if (update.properties !== undefined) {
          for (const [key, values] of Object.entries(update.properties)) {
            merged[fromTagLibKey(key)] = values;
          }
        }
        audioFile.setProperties(merged);
      }),
  );
}

/**
 * Open, mutate, and save multiple files with configurable concurrency.
 *
 * Mutator-callback variant of {@link writeTagsBatch}: the callback receives
 * the open {@link AudioFile} (Full-API style) plus the `path` it was opened
 * from — the pair is a per-invocation contract, so precomputed per-path
 * plans can be looked up without relying on invocation order (taglib-pmhp
 * review). A one-argument mutator keeps working. Changes are saved per file;
 * same {@link BatchOptions} contract and atomicity guarantees.
 *
 * @param files - File paths on disk, updated in place.
 * @param mutator - Called once per file with the open audio file and its
 *   path; changes are saved automatically.
 * @param options - Batch processing options (concurrency, error handling,
 *   progress, abort).
 * @returns A `BatchItem` per file in input order plus total duration in ms.
 * @throws If `continueOnError` is `false` and any file fails to process.
 */
export async function editTagsBatch(
  files: string[],
  mutator: (audioFile: AudioFile, path: string) => void,
  options: BatchOptions = {},
): Promise<BatchResult<void>> {
  return executeWriteBatch(
    files,
    options,
    (path) =>
      withAudioFileSaveToFile(path, (audioFile) => mutator(audioFile, path)),
  );
}
