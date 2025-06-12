/**
 * @fileoverview JSR-compatible simple API (uses taglib-jsr.ts instead of taglib.ts)
 */

import { TagLib } from "./taglib-jsr.ts";
import type { AudioProperties, Tag } from "./types.ts";

// Cached TagLib instance for auto-initialization
let cachedTagLib: TagLib | null = null;

/**
 * Get or create a TagLib instance with auto-initialization
 */
async function getTagLib(): Promise<TagLib> {
  if (!cachedTagLib) {
    cachedTagLib = await TagLib.initialize({
      debug: false,
      memory: {
        initial: 16 * 1024 * 1024, // 16MB default
        maximum: 64 * 1024 * 1024, // 64MB max
      },
    });
  }
  return cachedTagLib;
}

/**
 * Read a file's data from various sources
 */
async function readFileData(file: string | Uint8Array | ArrayBuffer | File): Promise<Uint8Array> {
  // Already a Uint8Array
  if (file instanceof Uint8Array) {
    return file;
  }
  
  // ArrayBuffer - convert to Uint8Array
  if (file instanceof ArrayBuffer) {
    return new Uint8Array(file);
  }
  
  // File object (browser)
  if (typeof File !== 'undefined' && file instanceof File) {
    return new Uint8Array(await file.arrayBuffer());
  }
  
  // String path - read from filesystem
  if (typeof file === 'string') {
    // Deno
    if (typeof Deno !== 'undefined') {
      return await Deno.readFile(file);
    }
    
    throw new Error('File path reading not supported in this environment');
  }
  
  throw new Error('Invalid file input type');
}

/**
 * Read metadata tags from an audio file
 */
export async function readTags(file: string | Uint8Array | ArrayBuffer | File): Promise<Tag> {
  const taglib = await getTagLib();
  const audioData = await readFileData(file);
  
  const audioFile = taglib.openFile(audioData);
  try {
    if (!audioFile.isValid()) {
      throw new Error('Invalid audio file');
    }
    
    return audioFile.tag();
  } finally {
    audioFile.dispose();
  }
}

/**
 * Write metadata tags to an audio file
 */
export async function writeTags(
  file: string | Uint8Array | ArrayBuffer | File, 
  tags: Partial<Tag>, 
  options?: number
): Promise<Uint8Array> {
  const taglib = await getTagLib();
  const audioData = await readFileData(file);
  
  const audioFile = taglib.openFile(audioData);
  try {
    if (!audioFile.isValid()) {
      throw new Error('Invalid audio file');
    }
    
    // Write each tag if defined
    if (tags.title !== undefined) audioFile.setTitle(tags.title);
    if (tags.artist !== undefined) audioFile.setArtist(tags.artist);
    if (tags.album !== undefined) audioFile.setAlbum(tags.album);
    if (tags.comment !== undefined) audioFile.setComment(tags.comment);
    if (tags.genre !== undefined) audioFile.setGenre(tags.genre);
    if (tags.year !== undefined) audioFile.setYear(tags.year);
    if (tags.track !== undefined) audioFile.setTrack(tags.track);
    
    // Save changes to in-memory buffer
    if (!audioFile.save()) {
      throw new Error('Failed to save changes');
    }
    
    return audioData;
  } finally {
    audioFile.dispose();
  }
}

/**
 * Read audio properties from a file
 */
export async function readProperties(file: string | Uint8Array | ArrayBuffer | File): Promise<AudioProperties> {
  const taglib = await getTagLib();
  const audioData = await readFileData(file);
  
  const audioFile = taglib.openFile(audioData);
  try {
    if (!audioFile.isValid()) {
      throw new Error('Invalid audio file');
    }
    
    return audioFile.audioProperties();
  } finally {
    audioFile.dispose();
  }
}

/**
 * Tag field constants for go-taglib compatibility
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

/**
 * Check if a file is a valid audio file
 */
export async function isValidAudioFile(file: string | Uint8Array | ArrayBuffer | File): Promise<boolean> {
  try {
    const taglib = await getTagLib();
    const audioData = await readFileData(file);
    
    const audioFile = taglib.openFile(audioData);
    const valid = audioFile.isValid();
    audioFile.dispose();
    
    return valid;
  } catch {
    return false;
  }
}

/**
 * Get the audio format of a file
 */
export async function getFormat(file: string | Uint8Array | ArrayBuffer | File): Promise<string | undefined> {
  const taglib = await getTagLib();
  const audioData = await readFileData(file);
  
  const audioFile = taglib.openFile(audioData);
  try {
    if (!audioFile.isValid()) {
      return undefined;
    }
    
    return audioFile.format();
  } finally {
    audioFile.dispose();
  }
}

/**
 * Clear all tags from a file
 */
export async function clearTags(file: string | Uint8Array | ArrayBuffer | File): Promise<Uint8Array> {
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

// Type exports for convenience
export type { Tag, AudioProperties } from "./types.ts";