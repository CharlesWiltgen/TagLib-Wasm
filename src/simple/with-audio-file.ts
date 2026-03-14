import type { AudioFile } from "../taglib/audio-file-interface.ts";
import type { AudioFileInput, OpenOptions } from "../types.ts";
import { FileOperationError, InvalidFormatError } from "../errors.ts";
import { getTagLib } from "./config.ts";

export async function withAudioFile<T>(
  file: AudioFileInput,
  fn: (audioFile: AudioFile) => T | Promise<T>,
  options?: OpenOptions,
): Promise<T> {
  const taglib = await getTagLib();
  const audioFile = await taglib.open(file, options);
  try {
    if (!audioFile.isValid()) {
      throw new InvalidFormatError(
        "File may be corrupted or in an unsupported format",
      );
    }
    return await fn(audioFile);
  } finally {
    audioFile.dispose();
  }
}

export async function withAudioFileSave(
  file: AudioFileInput,
  fn: (audioFile: AudioFile) => void,
): Promise<Uint8Array> {
  return withAudioFile(file, (audioFile) => {
    fn(audioFile);
    if (!audioFile.save()) {
      throw new FileOperationError(
        "save",
        "Failed to save metadata changes. The file may be read-only or corrupted.",
      );
    }
    return audioFile.getFileBuffer();
  }, { partial: false });
}

export async function withAudioFileSaveToFile(
  file: string,
  fn: (audioFile: AudioFile) => void,
): Promise<void> {
  return withAudioFile(file, async (audioFile) => {
    fn(audioFile);
    await audioFile.saveToFile(file);
  });
}
