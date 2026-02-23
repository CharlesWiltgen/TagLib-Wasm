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

function wrapSidecarResult(raw: Record<string, unknown>): Tag {
  const tag: Record<string, unknown> = {};
  for (const field of ["title", "artist", "album", "comment", "genre"]) {
    const val = raw[field];
    if (val === undefined || val === "") continue;
    tag[field] = Array.isArray(val) ? val : [val];
  }
  if (raw.year !== undefined) tag.year = raw.year;
  if (raw.track !== undefined) tag.track = raw.track;
  return tag as Tag;
}

function normalizeSidecarInput(
  tags: Partial<TagInput>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (
    const field of [
      "title",
      "artist",
      "album",
      "comment",
      "genre",
    ] as const
  ) {
    const val = tags[field];
    if (val === undefined) continue;
    result[field] = Array.isArray(val) ? val[0] ?? "" : val;
  }
  if (tags.year !== undefined) result.year = tags.year;
  if (tags.track !== undefined) result.track = tags.track;
  return result;
}

export async function readTags(
  file: AudioFileInput,
): Promise<Tag> {
  const taglib = await getTagLib();

  if (typeof file === "string" && taglib.sidecar?.isRunning()) {
    const raw = await taglib.sidecar.readTags(file);
    return wrapSidecarResult(raw as unknown as Record<string, unknown>);
  }

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

  const taglib = await getTagLib();

  if (taglib.sidecar?.isRunning()) {
    const existing = await taglib.sidecar.readTags(file);
    const normalized = normalizeSidecarInput(tags);
    const merged = { ...existing, ...normalized };
    await taglib.sidecar.writeTags(
      file,
      merged as unknown as import("../types.ts").ExtendedTag,
    );
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
