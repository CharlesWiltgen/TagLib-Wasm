/**
 * @fileoverview JSR-compatible simple API (uses taglib-jsr.ts instead of taglib.ts)
 */

import { TagLibJSR, AudioFileJSR } from "./taglib-jsr.ts";
import type { AudioProperties, Tag } from "./types.ts";

// Track TagLib instance
let taglib: TagLibJSR | null = null;

/**
 * Ensure TagLib is initialized
 */
async function ensureInitialized(): Promise<TagLibJSR> {
  if (!taglib) {
    await TagLibJSR.initialize();
    taglib = await TagLibJSR.getInstance();
  }
  return taglib;
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
  const taglib = await ensureInitialized();
  const audioData = await readFileData(file);
  
  const audioFile = await taglib.openFile(audioData.buffer);
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
  const taglib = await ensureInitialized();
  const audioData = await readFileData(file);
  
  const audioFile = await taglib.openFile(audioData.buffer);
  try {
    if (!audioFile.isValid()) {
      throw new Error('Invalid audio file');
    }
    
    // Set the tags
    const tag = audioFile.tag();
    if (tags.title !== undefined) tag.setTitle(tags.title);
    if (tags.artist !== undefined) tag.setArtist(tags.artist);
    if (tags.album !== undefined) tag.setAlbum(tags.album);
    if (tags.comment !== undefined) tag.setComment(tags.comment);
    if (tags.genre !== undefined) tag.setGenre(tags.genre);
    if (tags.year !== undefined) tag.setYear(tags.year);
    if (tags.track !== undefined) tag.setTrack(tags.track);
    
    // Save changes
    const success = audioFile.save();
    if (!success) {
      throw new Error('Failed to save tags');
    }
    
    // TODO: Return the modified file data
    // For now, return the original data
    return audioData;
  } finally {
    audioFile.dispose();
  }
}

/**
 * Read audio properties from a file
 */
export async function readProperties(file: string | Uint8Array | ArrayBuffer | File): Promise<AudioProperties> {
  const taglib = await ensureInitialized();
  const audioData = await readFileData(file);
  
  const audioFile = await taglib.openFile(audioData.buffer);
  try {
    if (!audioFile.isValid()) {
      throw new Error('Invalid audio file');
    }
    
    const props = audioFile.audioProperties();
    if (!props) {
      throw new Error('Failed to read audio properties');
    }
    return props;
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
    const taglib = await ensureInitialized();
    const audioData = await readFileData(file);
    
    const audioFile = await taglib.openFile(audioData.buffer);
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
  const taglib = await ensureInitialized();
  const audioData = await readFileData(file);
  
  const audioFile = await taglib.openFile(audioData.buffer);
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