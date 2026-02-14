import type { AudioProperties, Tag } from "../types.ts";
import { InvalidFormatError } from "../errors.ts";
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

export async function readTagsBatch(
  files: Array<string | Uint8Array | ArrayBuffer | File>,
  options: BatchOptions = {},
): Promise<BatchResult<Tag>> {
  const startTime = Date.now();
  const {
    concurrency = 4,
    continueOnError = true,
    onProgress,
  } = options;

  const results: Array<{ file: string; data: Tag }> = [];
  const errors: Array<{ file: string; error: Error }> = [];

  const taglib = await getTagLib();

  let processed = 0;
  const total = files.length;

  for (let i = 0; i < files.length; i += concurrency) {
    const chunk = files.slice(i, i + concurrency);

    const chunkPromises = chunk.map(async (file, idx) => {
      const fileIndex = i + idx;
      const fileName = typeof file === "string" ? file : `file-${fileIndex}`;

      try {
        const audioFile = await taglib.open(file);
        try {
          if (!audioFile.isValid()) {
            throw new InvalidFormatError(
              "File may be corrupted or in an unsupported format",
            );
          }
          const tags = audioFile.tag();
          results.push({ file: fileName, data: tags });
        } finally {
          audioFile.dispose();
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push({ file: fileName, error: err });
        if (!continueOnError) {
          throw err;
        }
      }

      processed++;
      onProgress?.(processed, total, fileName);
    });

    await Promise.all(chunkPromises);
  }

  return { results, errors, duration: Date.now() - startTime };
}

export async function readPropertiesBatch(
  files: Array<string | Uint8Array | ArrayBuffer | File>,
  options: BatchOptions = {},
): Promise<BatchResult<AudioProperties | null>> {
  const startTime = Date.now();
  const {
    concurrency = 4,
    continueOnError = true,
    onProgress,
  } = options;

  const results: Array<{ file: string; data: AudioProperties | null }> = [];
  const errors: Array<{ file: string; error: Error }> = [];

  const taglib = await getTagLib();

  let processed = 0;
  const total = files.length;

  for (let i = 0; i < files.length; i += concurrency) {
    const chunk = files.slice(i, i + concurrency);

    const chunkPromises = chunk.map(async (file, idx) => {
      const fileIndex = i + idx;
      const fileName = typeof file === "string" ? file : `file-${fileIndex}`;

      try {
        const audioFile = await taglib.open(file);
        try {
          if (!audioFile.isValid()) {
            throw new InvalidFormatError(
              "File may be corrupted or in an unsupported format",
            );
          }
          const properties = audioFile.audioProperties();
          results.push({ file: fileName, data: properties });
        } finally {
          audioFile.dispose();
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push({ file: fileName, error: err });
        if (!continueOnError) {
          throw err;
        }
      }

      processed++;
      onProgress?.(processed, total, fileName);
    });

    await Promise.all(chunkPromises);
  }

  return { results, errors, duration: Date.now() - startTime };
}

export async function readMetadataBatch(
  files: Array<string | Uint8Array | ArrayBuffer | File>,
  options: BatchOptions = {},
): Promise<
  BatchResult<{
    tags: Tag;
    properties: AudioProperties | null;
    hasCoverArt: boolean;
    dynamics?: {
      replayGainTrackGain?: string;
      replayGainTrackPeak?: string;
      replayGainAlbumGain?: string;
      replayGainAlbumPeak?: string;
      appleSoundCheck?: string;
    };
  }>
> {
  const startTime = Date.now();
  const {
    concurrency = 4,
    continueOnError = true,
    onProgress,
  } = options;

  const results: Array<{
    file: string;
    data: {
      tags: Tag;
      properties: AudioProperties | null;
      hasCoverArt: boolean;
      dynamics?: {
        replayGainTrackGain?: string;
        replayGainTrackPeak?: string;
        replayGainAlbumGain?: string;
        replayGainAlbumPeak?: string;
        appleSoundCheck?: string;
      };
    };
  }> = [];
  const errors: Array<{ file: string; error: Error }> = [];

  const taglib = await getTagLib();

  let processed = 0;
  const total = files.length;

  for (let i = 0; i < files.length; i += concurrency) {
    const chunk = files.slice(i, i + concurrency);

    const chunkPromises = chunk.map(async (file, idx) => {
      const fileIndex = i + idx;
      const fileName = typeof file === "string" ? file : `file-${fileIndex}`;

      try {
        const audioFile = await taglib.open(file);
        try {
          if (!audioFile.isValid()) {
            throw new InvalidFormatError(
              "File may be corrupted or in an unsupported format",
            );
          }
          const tags = audioFile.tag();
          const properties = audioFile.audioProperties();

          const pictures = audioFile.getPictures();
          const hasCoverArt = pictures.length > 0;

          const dynamics: Record<string, string> = {};

          const replayGainTrackGain = audioFile.getProperty(
            "REPLAYGAIN_TRACK_GAIN",
          );
          if (replayGainTrackGain) {
            dynamics.replayGainTrackGain = replayGainTrackGain;
          }

          const replayGainTrackPeak = audioFile.getProperty(
            "REPLAYGAIN_TRACK_PEAK",
          );
          if (replayGainTrackPeak) {
            dynamics.replayGainTrackPeak = replayGainTrackPeak;
          }

          const replayGainAlbumGain = audioFile.getProperty(
            "REPLAYGAIN_ALBUM_GAIN",
          );
          if (replayGainAlbumGain) {
            dynamics.replayGainAlbumGain = replayGainAlbumGain;
          }

          const replayGainAlbumPeak = audioFile.getProperty(
            "REPLAYGAIN_ALBUM_PEAK",
          );
          if (replayGainAlbumPeak) {
            dynamics.replayGainAlbumPeak = replayGainAlbumPeak;
          }

          let appleSoundCheck = audioFile.getProperty("ITUNNORM");
          if (!appleSoundCheck && audioFile.isMP4()) {
            appleSoundCheck = audioFile.getMP4Item(
              "----:com.apple.iTunes:iTunNORM",
            );
          }
          if (appleSoundCheck) dynamics.appleSoundCheck = appleSoundCheck;

          results.push({
            file: fileName,
            data: {
              tags,
              properties,
              hasCoverArt,
              dynamics: Object.keys(dynamics).length > 0 ? dynamics : undefined,
            },
          });
        } finally {
          audioFile.dispose();
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push({ file: fileName, error: err });
        if (!continueOnError) {
          throw err;
        }
      }

      processed++;
      onProgress?.(processed, total, fileName);
    });

    await Promise.all(chunkPromises);
  }

  return { results, errors, duration: Date.now() - startTime };
}
