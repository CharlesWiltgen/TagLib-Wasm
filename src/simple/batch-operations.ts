import type { AudioFile } from "../taglib.ts";
import type { AudioDynamics } from "../folder-api/types.ts";
import type { AudioFileInput, AudioProperties, Tag } from "../types.ts";
import { InvalidFormatError } from "../errors.ts";
import { mapPropertiesToTag } from "../utils/tag-mapping.ts";
import { getTagLib } from "./config.ts";

export interface BatchOptions {
  concurrency?: number;
  continueOnError?: boolean;
  onProgress?: (processed: number, total: number, currentFile: string) => void;
}

export type BatchItem<T> =
  | { status: "ok"; path: string; data: T }
  | { status: "error"; path: string; error: Error };

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
  const { concurrency = 4, continueOnError = true, onProgress } = options;
  const items: BatchItem<T>[] = new Array(files.length);
  const taglib = await getTagLib();
  let processed = 0;
  const total = files.length;

  for (let i = 0; i < files.length; i += concurrency) {
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

export async function readTagsBatch(
  files: AudioFileInput[],
  options: BatchOptions = {},
): Promise<BatchResult<Tag>> {
  return executeBatch(
    files,
    options,
    (audioFile) => mapPropertiesToTag(audioFile.properties()),
  );
}

export async function readPropertiesBatch(
  files: AudioFileInput[],
  options: BatchOptions = {},
): Promise<BatchResult<AudioProperties | null>> {
  return executeBatch(
    files,
    options,
    (audioFile) => audioFile.audioProperties(),
  );
}

export interface FileMetadata {
  tags: Tag;
  properties: AudioProperties | null;
  hasCoverArt: boolean;
  dynamics?: AudioDynamics;
}

function extractDynamics(audioFile: AudioFile): AudioDynamics | undefined {
  const dynamics: Record<string, string> = {};
  const props: Array<[string, string]> = [
    ["REPLAYGAIN_TRACK_GAIN", "replayGainTrackGain"],
    ["REPLAYGAIN_TRACK_PEAK", "replayGainTrackPeak"],
    ["REPLAYGAIN_ALBUM_GAIN", "replayGainAlbumGain"],
    ["REPLAYGAIN_ALBUM_PEAK", "replayGainAlbumPeak"],
  ];
  for (const [key, field] of props) {
    const val = audioFile.getProperty(key);
    if (val) dynamics[field] = val;
  }
  let appleSoundCheck = audioFile.getProperty("ITUNNORM");
  if (!appleSoundCheck && audioFile.isMP4()) {
    appleSoundCheck = audioFile.getMP4Item("----:com.apple.iTunes:iTunNORM");
  }
  if (appleSoundCheck) dynamics.appleSoundCheck = appleSoundCheck;
  return Object.keys(dynamics).length > 0
    ? dynamics as AudioDynamics
    : undefined;
}

export async function readMetadataBatch(
  files: AudioFileInput[],
  options: BatchOptions = {},
): Promise<BatchResult<FileMetadata>> {
  return executeBatch(files, options, (audioFile) => ({
    tags: mapPropertiesToTag(audioFile.properties()),
    properties: audioFile.audioProperties(),
    hasCoverArt: audioFile.getPictures().length > 0,
    dynamics: extractDynamics(audioFile),
  }));
}
