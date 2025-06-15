/**
 * @fileoverview Simplified API for taglib-wasm matching go-taglib's interface
 *
 * This module provides a dead-simple API for reading and writing audio metadata,
 * inspired by go-taglib's excellent developer experience.
 *
 * @example
 * ```typescript
 * import { readTags, writeTags, readProperties } from "taglib-wasm/simple";
 *
 * // Read tags
 * const tags = await readTags("song.mp3");
 * console.log(tags.album);
 *
 * // Write tags
 * await writeTags("song.mp3", {
 *   album: "New Album",
 *   artist: "New Artist"
 * });
 *
 * // Read audio properties
 * const props = await readProperties("song.mp3");
 * console.log(`Duration: ${props.length}s, Bitrate: ${props.bitrate}kbps`);
 * ```
 */

import { TagLib } from "./taglib.ts";
import type { AudioProperties, Tag } from "./types.ts";
import {
  FileOperationError,
  InvalidFormatError,
  MetadataError,
} from "./errors.ts";
import { readFileData } from "./utils/file.ts";
import { writeFileData } from "./utils/write.ts";

// Cached TagLib instance for auto-initialization
let cachedTagLib: TagLib | null = null;

/**
 * Get or create a TagLib instance with auto-initialization.
 * Uses a cached instance for performance.
 *
 * @internal
 * @returns Promise resolving to TagLib instance
 */
async function getTagLib(): Promise<TagLib> {
  if (!cachedTagLib) {
    // Use the NPM version for compatibility
    const { TagLib } = await import("./taglib.ts");
    cachedTagLib = await TagLib.initialize();
  }
  return cachedTagLib as TagLib;
}

/**
 * Read metadata tags from an audio file
 *
 * @param file - File path, Uint8Array buffer, ArrayBuffer, or File object
 * @returns Object containing all metadata tags
 *
 * @example
 * ```typescript
 * const tags = await readTags("song.mp3");
 * console.log(tags.title, tags.artist, tags.album);
 * ```
 */
export async function readTags(
  file: string | Uint8Array | ArrayBuffer | File,
): Promise<Tag> {
  const taglib = await getTagLib();
  const audioFile = await taglib.open(file);
  try {
    if (!audioFile.isValid()) {
      throw new InvalidFormatError(
        "File may be corrupted or in an unsupported format"
      );
    }

    return audioFile.tag();
  } finally {
    audioFile.dispose();
  }
}

/**
 * Write metadata tags to an audio file
 *
 * Note: This modifies the in-memory representation only.
 * To persist changes, you need to get the modified buffer.
 *
 * @param file - File path, Uint8Array buffer, ArrayBuffer, or File object
 * @param tags - Object containing tags to write (undefined values are ignored)
 * @param options - Write options (currently unused, for go-taglib compatibility)
 * @returns Modified file buffer
 *
 * @example
 * ```typescript
 * const modifiedBuffer = await writeTags("song.mp3", {
 *   title: "New Title",
 *   artist: "New Artist",
 *   album: "New Album",
 *   year: 2025
 * });
 * // Save modifiedBuffer to file or use as needed
 * ```
 */
export async function writeTags(
  file: string | Uint8Array | ArrayBuffer | File,
  tags: Partial<Tag>,
  options?: number,
): Promise<Uint8Array> {
  const taglib = await getTagLib();
  const audioFile = await taglib.open(file);
  try {
    if (!audioFile.isValid()) {
      throw new InvalidFormatError(
        "File may be corrupted or in an unsupported format"
      );
    }

    // Get the tag object and write each tag if defined
    const tag = audioFile.tag();
    if (tags.title !== undefined) tag.setTitle(tags.title);
    if (tags.artist !== undefined) tag.setArtist(tags.artist);
    if (tags.album !== undefined) tag.setAlbum(tags.album);
    if (tags.comment !== undefined) tag.setComment(tags.comment);
    if (tags.genre !== undefined) tag.setGenre(tags.genre);
    if (tags.year !== undefined) tag.setYear(tags.year);
    if (tags.track !== undefined) tag.setTrack(tags.track);

    // Save changes to in-memory buffer
    if (!audioFile.save()) {
      throw new FileOperationError(
        "save",
        "Failed to save metadata changes. The file may be read-only or corrupted."
      );
    }

    // Get the modified buffer after saving
    return audioFile.getFileBuffer();
  } finally {
    audioFile.dispose();
  }
}

/**
 * Update metadata tags in an audio file and save to disk
 *
 * This is a convenience function that combines writeTags and file writing.
 * It modifies the file in-place, updating the metadata and saving changes.
 *
 * @param file - File path (must be a string for saving back to disk)
 * @param tags - Object containing tags to write (undefined values are ignored)
 * @param options - Write options (currently unused, for go-taglib compatibility)
 * @throws {Error} If file path is not a string or write fails
 *
 * @example
 * ```typescript
 * await updateTags("song.mp3", {
 *   title: "New Title",
 *   artist: "New Artist",
 *   album: "New Album",
 *   year: 2025
 * });
 * ```
 */
export async function updateTags(
  file: string,
  tags: Partial<Tag>,
  options?: number,
): Promise<void> {
  if (typeof file !== "string") {
    throw new Error("updateTags requires a file path string to save changes");
  }

  // Get the modified buffer
  const modifiedBuffer = await writeTags(file, tags, options);
  
  // Write the buffer back to the file
  await writeFileData(file, modifiedBuffer);
}

/**
 * Read audio properties from a file
 *
 * @param file - File path, Uint8Array buffer, ArrayBuffer, or File object
 * @returns Audio properties including duration, bitrate, sample rate, etc.
 *
 * @example
 * ```typescript
 * const props = await readProperties("song.mp3");
 * console.log(`Duration: ${props.length} seconds`);
 * console.log(`Bitrate: ${props.bitrate} kbps`);
 * console.log(`Sample rate: ${props.sampleRate} Hz`);
 * ```
 */
export async function readProperties(
  file: string | Uint8Array | ArrayBuffer | File,
): Promise<AudioProperties> {
  const taglib = await getTagLib();
  const audioFile = await taglib.open(file);
  try {
    if (!audioFile.isValid()) {
      throw new InvalidFormatError(
        "File may be corrupted or in an unsupported format"
      );
    }

    const props = audioFile.audioProperties();
    if (!props) {
      throw new MetadataError(
        "read",
        "File may not contain valid audio data",
        "audioProperties"
      );
    }
    return props;
  } finally {
    audioFile.dispose();
  }
}

/**
 * Tag field constants for go-taglib compatibility.
 * These match the constants used in go-taglib for consistent API.
 *
 * @example
 * ```typescript
 * import { Title, Artist, Album } from "taglib-wasm/simple";
 *
 * const tags = await readTags("song.mp3");
 * console.log(tags[Title]);  // Same as tags.title
 * console.log(tags[Artist]); // Same as tags.artist
 * ```
 */
export const Title = "title";
export const Artist = "artist";
export const Album = "album";
export const Comment = "comment";
export const Genre = "genre";
export const Year = "year";
export const Track = "track";
export const AlbumArtist = "albumartist";
export const Composer = "composer";
export const DiscNumber = "discnumber";

// Additional convenience functions

/**
 * Check if a file is a valid audio file
 *
 * @param file - File path, Uint8Array buffer, ArrayBuffer, or File object
 * @returns true if the file is a valid audio file
 *
 * @example
 * ```typescript
 * if (await isValidAudioFile("maybe-audio.bin")) {
 *   const tags = await readTags("maybe-audio.bin");
 * }
 * ```
 */
export async function isValidAudioFile(
  file: string | Uint8Array | ArrayBuffer | File,
): Promise<boolean> {
  try {
    const taglib = await getTagLib();
    const audioFile = await taglib.open(file);
    const valid = audioFile.isValid();
    audioFile.dispose();

    return valid;
  } catch {
    return false;
  }
}

/**
 * Get the audio format of a file
 *
 * @param file - File path, Uint8Array buffer, ArrayBuffer, or File object
 * @returns Audio format string (e.g., "MP3", "FLAC", "OGG") or undefined
 *
 * @example
 * ```typescript
 * const format = await getFormat("song.mp3");
 * console.log(`File format: ${format}`); // "MP3"
 * ```
 */
export async function getFormat(
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

/**
 * Clear all tags from a file
 *
 * @param file - File path, Uint8Array buffer, ArrayBuffer, or File object
 * @returns Modified file buffer with tags removed
 *
 * @example
 * ```typescript
 * const cleanBuffer = await clearTags("song.mp3");
 * // Save cleanBuffer to remove all metadata
 * ```
 */
export async function clearTags(
  file: string | Uint8Array | ArrayBuffer | File,
): Promise<Uint8Array> {
  return writeTags(file, {
    title: "",
    artist: "",
    album: "",
    comment: "",
    genre: "",
    year: 0,
    track: 0,
  });
}

/**
 * Re-export commonly used types for convenience.
 * These types define the structure of metadata and audio properties.
 */
export type { AudioProperties, Tag } from "./types.ts";
