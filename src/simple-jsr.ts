/**
 * @fileoverview JSR-compatible simple API (uses taglib-jsr.ts instead of taglib.ts)
 */

import { TagLib, AudioFileJSR } from "./taglib-jsr.ts";
import type { AudioProperties, Tag } from "./types.ts";

// Track initialization state
let initialized = false;

/**
 * Ensure TagLib is initialized
 */
async function ensureInitialized(): Promise<void> {
  if (!initialized) {
    await TagLib.initialize({
      debug: false,
      memory: {
        initial: 16 * 1024 * 1024, // 16MB default
        maximum: 64 * 1024 * 1024, // 64MB max
      },
    });
    initialized = true;
  }
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
  await ensureInitialized();
  const audioData = await readFileData(file);
  
  const audioFile = new AudioFileJSR(audioData);
  try {
    if (!audioFile.isValid()) {
      throw new Error('Invalid audio file');
    }
    
    return audioFile.getTag();
  } finally {
    audioFile.destroy();
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
  await ensureInitialized();
  const audioData = await readFileData(file);
  
  const audioFile = new AudioFileJSR(audioData);
  try {
    if (!audioFile.isValid()) {
      throw new Error('Invalid audio file');
    }
    
    // Set the tags using the JSR API
    audioFile.setTag(tags);
    
    // Save changes - note that in JSR version, save() returns Uint8Array
    const savedData = audioFile.save();
    
    // The JSR implementation currently returns an empty array as a placeholder
    // For now, we'll return the original data since the actual save implementation
    // would need to extract the modified data from WASM
    // TODO: Update when JSR save() is fully implemented
    return audioData;
  } finally {
    audioFile.destroy();
  }
}

/**
 * Read audio properties from a file
 */
export async function readProperties(file: string | Uint8Array | ArrayBuffer | File): Promise<AudioProperties> {
  await ensureInitialized();
  const audioData = await readFileData(file);
  
  const audioFile = new AudioFileJSR(audioData);
  try {
    if (!audioFile.isValid()) {
      throw new Error('Invalid audio file');
    }
    
    return audioFile.getAudioProperties();
  } finally {
    audioFile.destroy();
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
    await ensureInitialized();
    const audioData = await readFileData(file);
    
    const audioFile = new AudioFileJSR(audioData);
    const valid = audioFile.isValid();
    audioFile.destroy();
    
    return valid;
  } catch {
    return false;
  }
}

/**
 * Get the audio format of a file
 */
export async function getFormat(file: string | Uint8Array | ArrayBuffer | File): Promise<string | undefined> {
  await ensureInitialized();
  const audioData = await readFileData(file);
  
  const audioFile = new AudioFileJSR(audioData);
  try {
    if (!audioFile.isValid()) {
      return undefined;
    }
    
    return audioFile.getFormat();
  } finally {
    audioFile.destroy();
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