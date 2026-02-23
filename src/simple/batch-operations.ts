import type { AudioFile } from "../taglib.ts";
import type { AudioProperties, Tag } from "../types.ts";
import { InvalidFormatError } from "../errors.ts";
import { mapPropertiesToTag } from "../utils/tag-mapping.ts";
import { getTagLib } from "./config.ts";

export interface BatchOptions {
  concurrency?: number;
  continueOnError?: boolean;
  onProgress?: (processed: number, total: number, currentFile: string) => void;
}

export interface BatchResult<T> {
  results: Array<{ file: string; data: T }>;
  errors: Array<{ file: string; error: Error }>;
  duration: number;
}

type FileInput = string | Uint8Array | ArrayBuffer | File;

async function executeBatch<T>(
  files: FileInput[],
  options: BatchOptions,
  processor: (audioFile: AudioFile) => T,
): Promise<BatchResult<T>> {
  const startTime = Date.now();
  const { concurrency = 4, continueOnError = true, onProgress } = options;
  const results: Array<{ file: string; data: T }> = [];
  const errors: Array<{ file: string; error: Error }> = [];
  const taglib = await getTagLib();
  let processed = 0;
  const total = files.length;

  for (let i = 0; i < files.length; i += concurrency) {
    const chunk = files.slice(i, i + concurrency);
    const chunkPromises = chunk.map(async (file, idx) => {
      const fileName = typeof file === "string" ? file : `file-${i + idx}`;
      try {
        const audioFile = await taglib.open(file);
        try {
          if (!audioFile.isValid()) {
            throw new InvalidFormatError(
              "File may be corrupted or in an unsupported format",
            );
          }
          results.push({ file: fileName, data: processor(audioFile) });
        } finally {
          audioFile.dispose();
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push({ file: fileName, error: err });
        if (!continueOnError) throw err;
      }
      processed++;
      onProgress?.(processed, total, fileName);
    });
    await Promise.all(chunkPromises);
  }
  return { results, errors, duration: Date.now() - startTime };
}

export async function readTagsBatch(
  files: FileInput[],
  options: BatchOptions = {},
): Promise<BatchResult<Tag>> {
  return executeBatch(
    files,
    options,
    (audioFile) => mapPropertiesToTag(audioFile.properties()),
  );
}

export async function readPropertiesBatch(
  files: FileInput[],
  options: BatchOptions = {},
): Promise<BatchResult<AudioProperties | null>> {
  return executeBatch(
    files,
    options,
    (audioFile) => audioFile.audioProperties(),
  );
}

interface MetadataDynamics {
  replayGainTrackGain?: string;
  replayGainTrackPeak?: string;
  replayGainAlbumGain?: string;
  replayGainAlbumPeak?: string;
  appleSoundCheck?: string;
}

interface FileMetadata {
  tags: Tag;
  properties: AudioProperties | null;
  hasCoverArt: boolean;
  dynamics?: MetadataDynamics;
}

function extractDynamics(audioFile: AudioFile): MetadataDynamics | undefined {
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
    ? dynamics as MetadataDynamics
    : undefined;
}

export async function readMetadataBatch(
  files: FileInput[],
  options: BatchOptions = {},
): Promise<BatchResult<FileMetadata>> {
  return executeBatch(files, options, (audioFile) => ({
    tags: mapPropertiesToTag(audioFile.properties()),
    properties: audioFile.audioProperties(),
    hasCoverArt: audioFile.getPictures().length > 0,
    dynamics: extractDynamics(audioFile),
  }));
}
