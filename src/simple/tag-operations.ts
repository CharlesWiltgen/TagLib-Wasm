import type { AudioFileInput, AudioProperties, Tag } from "../types.ts";
import {
  FileOperationError,
  InvalidFormatError,
  MetadataError,
} from "../errors.ts";
import { writeFileData } from "../utils/write.ts";
import { getTagLib } from "./config.ts";

export async function readTags(
  file: AudioFileInput,
): Promise<Tag> {
  const taglib = await getTagLib();

  if (typeof file === "string" && taglib.sidecar?.isRunning()) {
    return taglib.sidecar.readTags(file);
  }

  const audioFile = await taglib.open(file);
  try {
    if (!audioFile.isValid()) {
      throw new InvalidFormatError(
        "File may be corrupted or in an unsupported format",
      );
    }

    return audioFile.tag();
  } finally {
    audioFile.dispose();
  }
}

export async function applyTagsToBuffer(
  file: string | Uint8Array | ArrayBuffer | File,
  tags: Partial<Tag>,
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

    const tag = audioFile.tag();
    if (tags.title !== undefined) tag.setTitle(tags.title);
    if (tags.artist !== undefined) tag.setArtist(tags.artist);
    if (tags.album !== undefined) tag.setAlbum(tags.album);
    if (tags.comment !== undefined) tag.setComment(tags.comment);
    if (tags.genre !== undefined) tag.setGenre(tags.genre);
    if (tags.year !== undefined) tag.setYear(tags.year);
    if (tags.track !== undefined) tag.setTrack(tags.track);

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
  tags: Partial<Tag>,
  options?: number,
): Promise<void> {
  if (typeof file !== "string") {
    throw new FileOperationError(
      "save",
      "writeTagsToFile requires a file path string to save changes",
    );
  }

  const taglib = await getTagLib();

  if (taglib.sidecar?.isRunning()) {
    const existing = await taglib.sidecar.readTags(file);
    const merged = { ...existing, ...tags };
    await taglib.sidecar.writeTags(file, merged);
    return;
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
