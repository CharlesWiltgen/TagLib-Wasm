import type {
  AudioFileInput,
  AudioProperties,
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

export async function applyTagsToBuffer(
  file: string | Uint8Array | ArrayBuffer | File,
  tags: Partial<TagInput>,
  _options?: number,
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

export async function writeTagsToFile(
  file: string,
  tags: Partial<TagInput>,
  options?: number,
): Promise<void> {
  if (typeof file !== "string") {
    throw new FileOperationError(
      "save",
      "writeTagsToFile requires a file path string to save changes",
    );
  }

  const modifiedBuffer = await applyTagsToBuffer(file, tags, options);
  await writeFileData(file, modifiedBuffer);
}

export async function readProperties(
  file: string | Uint8Array | ArrayBuffer | File,
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

export async function isValidAudioFile(
  file: string | Uint8Array | ArrayBuffer | File,
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

export async function readFormat(
  file: string | Uint8Array | ArrayBuffer | File,
): Promise<string | undefined> {
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

export async function clearTags(
  file: string | Uint8Array | ArrayBuffer | File,
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
