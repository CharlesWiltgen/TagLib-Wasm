/**
 * File processing helpers for reading audio metadata
 */

import type { TagLib } from "../taglib.ts";
import type {
  AudioDynamics,
  AudioFileMetadata,
  AudioProperties,
} from "./types.ts";
import { mapPropertiesToExtendedTag } from "../utils/tag-mapping.ts";

export async function processBatch<T>(
  files: string[],
  processor: (path: string) => Promise<T>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < files.length; i += concurrency) {
    const chunk = files.slice(i, i + concurrency);
    const chunkResults = await Promise.all(
      chunk.map((file) => processor(file)),
    );
    results.push(...chunkResults);
  }

  return results;
}

export async function processFileWithTagLib(
  filePath: string,
  taglib: TagLib,
  includeProperties: boolean,
  onProgress?: (processed: number, total: number, currentFile: string) => void,
  processed?: { count: number },
  totalFound?: number,
): Promise<AudioFileMetadata> {
  const audioFile = await taglib.open(filePath);
  try {
    const tags = mapPropertiesToExtendedTag(audioFile.properties());
    let properties: AudioProperties | undefined;

    if (includeProperties) {
      const props = audioFile.audioProperties();
      if (props) {
        properties = props;
      }
    }

    const pictures = audioFile.getPictures();
    const hasCoverArt = pictures.length > 0;

    const dynamics: AudioDynamics = {};
    const fieldNames = [
      "replayGainTrackGain",
      "replayGainTrackPeak",
      "replayGainAlbumGain",
      "replayGainAlbumPeak",
    ];

    for (const field of fieldNames) {
      const value = audioFile.getProperty(field);
      if (value) {
        (dynamics as any)[field] = value;
      }
    }

    let appleSoundCheck = audioFile.getProperty("appleSoundCheck");
    if (!appleSoundCheck && audioFile.isMP4()) {
      appleSoundCheck = audioFile.getMP4Item("----:com.apple.iTunes:iTunNORM");
    }
    if (appleSoundCheck) dynamics.appleSoundCheck = appleSoundCheck;

    if (processed !== undefined && totalFound !== undefined) {
      const current = ++processed.count;
      onProgress?.(current, totalFound, filePath);
    }

    return {
      path: filePath,
      tags,
      properties,
      hasCoverArt,
      dynamics: Object.keys(dynamics).length > 0 ? dynamics : undefined,
    };
  } finally {
    audioFile.dispose();
  }
}
