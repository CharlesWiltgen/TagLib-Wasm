import type { AudioFile } from "../taglib/audio-file-interface.ts";
import type { AudioFileInput } from "../types.ts";
import { FileOperationError, InvalidFormatError } from "../errors.ts";
import { getTagLib } from "./config.ts";

export async function withAudioFile<T>(
  file: AudioFileInput,
  fn: (audioFile: AudioFile) => T,
): Promise<T> {
  const taglib = await getTagLib();
  const audioFile = await taglib.open(file);
  try {
    if (!audioFile.isValid()) {
      throw new InvalidFormatError(
        "File may be corrupted or in an unsupported format",
      );
    }
    return fn(audioFile);
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
  });
}
