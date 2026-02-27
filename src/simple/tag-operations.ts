import type {
  AudioFileInput,
  AudioProperties,
  FileType,
  Tag,
  TagInput,
} from "../types.ts";
import {
  FileOperationError,
  InvalidFormatError,
  MetadataError,
} from "../errors.ts";
import { writeFileData } from "../utils/write.ts";
import { mapPropertiesToTag, normalizeTagInput } from "../utils/tag-mapping.ts";
import { getTagLib } from "./config.ts";

/**
 * Reads all metadata tags from an audio file.
 *
 * @param file - File path, Uint8Array, ArrayBuffer, or File object
 * @returns Parsed tag fields from the audio file
 * @throws {TagLibInitializationError} If the Wasm module fails to initialize
 * @throws {InvalidFormatError} If the file is corrupted or in an unsupported format
 */
export async function readTags(
  file: AudioFileInput,
): Promise<Tag> {
  const taglib = await getTagLib();
  const audioFile = await taglib.open(file);
  try {
    if (!audioFile.isValid()) {
      throw new InvalidFormatError(
        "File may be corrupted or in an unsupported format",
      );
    }

    const props = audioFile.properties();
    return mapPropertiesToTag(props);
  } finally {
    audioFile.dispose();
  }
}

/**
 * Applies metadata tag changes to an audio file and returns the modified content as a buffer.
 *
 * @param file - File path, Uint8Array, ArrayBuffer, or File object
 * @param tags - Partial tag fields to merge with existing metadata
 * @returns Modified audio file contents with updated tags
 * @throws {TagLibInitializationError} If the Wasm module fails to initialize
 * @throws {InvalidFormatError} If the file is corrupted or in an unsupported format
 * @throws {FileOperationError} If saving the modified metadata fails
 */
export async function applyTagsToBuffer(
  file: AudioFileInput,
  tags: Partial<TagInput>,
): Promise<Uint8Array> {
  const taglib = await getTagLib();
  const audioFile = await taglib.open(file);
  try {
    if (!audioFile.isValid()) {
      throw new InvalidFormatError(
        "File may be corrupted or in an unsupported format",
      );
    }

    const currentProps = audioFile.properties();
    const newProps = normalizeTagInput(tags);
    const merged = { ...currentProps, ...newProps };
    audioFile.setProperties(merged);

    if (!audioFile.save()) {
      throw new FileOperationError(
        "save",
        "Failed to save metadata changes. The file may be read-only or corrupted.",
      );
    }

    return audioFile.getFileBuffer();
  } finally {
    audioFile.dispose();
  }
}

/**
 * Writes metadata tag changes directly to an audio file on disk.
 *
 * @param file - File path string; the file is updated in place
 * @param tags - Partial tag fields to merge with existing metadata
 * @returns Resolves when the file has been written successfully
 * @throws {FileOperationError} If a non-string input is provided, saving fails, or the file write fails
 * @throws {TagLibInitializationError} If the Wasm module fails to initialize
 * @throws {InvalidFormatError} If the file is corrupted or in an unsupported format
 * @throws {EnvironmentError} If the runtime does not support filesystem write access
 */
export async function writeTagsToFile(
  file: string,
  tags: Partial<TagInput>,
): Promise<void> {
  if (typeof file !== "string") {
    throw new FileOperationError(
      "save",
      "writeTagsToFile requires a file path string to save changes",
    );
  }

  const modifiedBuffer = await applyTagsToBuffer(file, tags);
  await writeFileData(file, modifiedBuffer);
}

/**
 * Reads audio properties (duration, bitrate, sample rate, channels) from an audio file.
 *
 * @param file - File path, Uint8Array, ArrayBuffer, or File object
 * @returns Audio codec properties for the file
 * @throws {TagLibInitializationError} If the Wasm module fails to initialize
 * @throws {InvalidFormatError} If the file is corrupted or in an unsupported format
 * @throws {MetadataError} If the file does not contain valid audio property data
 */
export async function readProperties(
  file: AudioFileInput,
): Promise<AudioProperties> {
  const taglib = await getTagLib();
  const audioFile = await taglib.open(file);
  try {
    if (!audioFile.isValid()) {
      throw new InvalidFormatError(
        "File may be corrupted or in an unsupported format",
      );
    }

    const props = audioFile.audioProperties();
    if (!props) {
      throw new MetadataError(
        "read",
        "File may not contain valid audio data",
        "audioProperties",
      );
    }
    return props;
  } finally {
    audioFile.dispose();
  }
}

/**
 * Checks whether the given input is a valid, readable audio file.
 *
 * @param file - File path, Uint8Array, ArrayBuffer, or File object
 * @returns `true` if the file is valid and recognized by TagLib; `false` otherwise
 */
export async function isValidAudioFile(
  file: AudioFileInput,
): Promise<boolean> {
  try {
    const taglib = await getTagLib();
    const audioFile = await taglib.open(file);
    try {
      return audioFile.isValid();
    } finally {
      audioFile.dispose();
    }
  } catch {
    return false;
  }
}

/**
 * Detects the audio format of a file.
 *
 * @param file - File path, Uint8Array, ArrayBuffer, or File object
 * @returns The detected `FileType`, or `undefined` if the format cannot be determined
 * @throws {TagLibInitializationError} If the Wasm module fails to initialize
 */
export async function readFormat(
  file: AudioFileInput,
): Promise<FileType | undefined> {
  const taglib = await getTagLib();
  const audioFile = await taglib.open(file);
  try {
    if (!audioFile.isValid()) {
      return undefined;
    }

    return audioFile.getFormat();
  } finally {
    audioFile.dispose();
  }
}

/**
 * Removes all standard metadata tags from an audio file and returns the stripped content as a buffer.
 *
 * @param file - File path, Uint8Array, ArrayBuffer, or File object
 * @returns Modified audio file contents with all standard tags cleared
 * @throws {TagLibInitializationError} If the Wasm module fails to initialize
 * @throws {InvalidFormatError} If the file is corrupted or in an unsupported format
 * @throws {FileOperationError} If saving the modified metadata fails
 */
export async function clearTags(
  file: AudioFileInput,
): Promise<Uint8Array> {
  return applyTagsToBuffer(file, {
    title: "",
    artist: "",
    album: "",
    comment: "",
    genre: "",
    year: 0,
    track: 0,
  });
}
