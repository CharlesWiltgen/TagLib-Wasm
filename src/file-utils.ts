/**
 * @fileoverview File I/O utilities for working with cover art in taglib-wasm
 *
 * This module provides file system helpers for saving and loading cover art
 * in Node.js, Deno, and Bun environments.
 *
 * @example
 * ```typescript
 * import { exportCoverArt, importCoverArt } from "taglib-wasm/file-utils";
 *
 * // Export cover art from audio file to image file
 * await exportCoverArt("song.mp3", "cover.jpg");
 *
 * // Import cover art from image file to audio file
 * await importCoverArt("song.mp3", "new-cover.png");
 * ```
 */

import type { Picture } from "./types.ts";
import { PictureType } from "./types.ts";
import {
  readPictures,
  applyPictures,
  setCoverArt,
  getCoverArt,
  replacePictureByType,
} from "./simple.ts";
import { readFileData } from "./utils/file.ts";
import { writeFileData } from "./utils/write.ts";

/**
 * Export cover art from an audio file to an image file
 *
 * Extracts the primary cover art (front cover if available, otherwise first picture)
 * and saves it to the specified path.
 *
 * @param audioPath - Path to the audio file
 * @param imagePath - Path where the image should be saved
 * @returns Promise that resolves when the image is saved
 * @throws Error if no cover art is found
 *
 * @example
 * ```typescript
 * // Export cover art as JPEG
 * await exportCoverArt("album/track01.mp3", "album/cover.jpg");
 * ```
 */
export async function exportCoverArt(
  audioPath: string,
  imagePath: string,
): Promise<void> {
  const coverData = await getCoverArt(audioPath);
  if (!coverData) {
    throw new Error(`No cover art found in: ${audioPath}`);
  }
  
  await writeFileData(imagePath, coverData);
}

/**
 * Export a specific picture type from an audio file
 *
 * @param audioPath - Path to the audio file
 * @param imagePath - Path where the image should be saved
 * @param type - Picture type to export
 * @returns Promise that resolves when the image is saved
 * @throws Error if no picture of the specified type is found
 *
 * @example
 * ```typescript
 * // Export back cover
 * await exportPictureByType(
 *   "album/track01.mp3",
 *   "album/back-cover.jpg",
 *   PictureType.BackCover
 * );
 * ```
 */
export async function exportPictureByType(
  audioPath: string,
  imagePath: string,
  type: PictureType,
): Promise<void> {
  const pictures = await readPictures(audioPath);
  const picture = pictures.find(pic => pic.type === type);
  
  if (!picture) {
    throw new Error(`No picture of type ${type} found in: ${audioPath}`);
  }
  
  await writeFileData(imagePath, picture.data);
}

/**
 * Export all pictures from an audio file
 *
 * Saves each picture with a numbered suffix based on its type and index.
 *
 * @param audioPath - Path to the audio file
 * @param outputDir - Directory where images should be saved
 * @param options - Export options
 * @returns Promise resolving to array of created file paths
 *
 * @example
 * ```typescript
 * // Export all pictures to a directory
 * const files = await exportAllPictures("song.mp3", "./artwork/");
 * console.log(`Exported ${files.length} pictures`);
 * ```
 */
export async function exportAllPictures(
  audioPath: string,
  outputDir: string,
  options: {
    nameFormat?: (picture: Picture, index: number) => string;
  } = {},
): Promise<string[]> {
  const pictures = await readPictures(audioPath);
  const exportedPaths: string[] = [];
  
  // Ensure directory ends with separator
  const dir = outputDir.endsWith('/') ? outputDir : outputDir + '/';
  
  for (let i = 0; i < pictures.length; i++) {
    const picture = pictures[i];
    
    // Determine filename
    let filename: string;
    if (options.nameFormat) {
      filename = options.nameFormat(picture, i);
    } else {
      // Default naming: type-index.ext
      const typeNames: Record<number, string> = {
        [PictureType.FrontCover]: 'front-cover',
        [PictureType.BackCover]: 'back-cover',
        [PictureType.LeafletPage]: 'leaflet',
        [PictureType.Media]: 'media',
        [PictureType.LeadArtist]: 'lead-artist',
        [PictureType.Artist]: 'artist',
        [PictureType.Conductor]: 'conductor',
        [PictureType.Band]: 'band',
        [PictureType.Composer]: 'composer',
        [PictureType.Lyricist]: 'lyricist',
        [PictureType.RecordingLocation]: 'recording-location',
        [PictureType.DuringRecording]: 'during-recording',
        [PictureType.DuringPerformance]: 'during-performance',
        [PictureType.MovieScreenCapture]: 'screen-capture',
        [PictureType.ColouredFish]: 'fish',
        [PictureType.Illustration]: 'illustration',
        [PictureType.BandLogo]: 'band-logo',
        [PictureType.PublisherLogo]: 'publisher-logo',
      };
      
      const typeName = typeNames[picture.type] || 'other';
      const ext = picture.mimeType.split('/')[1] || 'jpg';
      filename = `${typeName}-${i + 1}.${ext}`;
    }
    
    const fullPath = dir + filename;
    await writeFileData(fullPath, picture.data);
    exportedPaths.push(fullPath);
  }
  
  return exportedPaths;
}

/**
 * Import cover art from an image file to an audio file
 *
 * Replaces all existing pictures with a single front cover from the image file.
 * The audio file is modified in place.
 *
 * @param audioPath - Path to the audio file to update
 * @param imagePath - Path to the image file to import
 * @param options - Import options
 * @returns Promise that resolves when the audio file is updated
 *
 * @example
 * ```typescript
 * // Replace cover art with a new image
 * await importCoverArt("song.mp3", "new-cover.jpg");
 * ```
 */
export async function importCoverArt(
  audioPath: string,
  imagePath: string,
  options: {
    mimeType?: string;
    description?: string;
  } = {},
): Promise<void> {
  const imageData = await readFileData(imagePath);
  
  // Detect MIME type from file extension if not provided
  let mimeType = options.mimeType;
  if (!mimeType) {
    const ext = imagePath.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
    };
    mimeType = mimeTypes[ext || ''] || 'image/jpeg';
  }
  
  const modifiedBuffer = await setCoverArt(audioPath, imageData, mimeType);
  await writeFileData(audioPath, modifiedBuffer);
}

/**
 * Import a picture from file with specific type
 *
 * Adds or replaces a picture of the specified type in the audio file.
 * The audio file is modified in place.
 *
 * @param audioPath - Path to the audio file to update
 * @param imagePath - Path to the image file to import
 * @param type - Picture type to set
 * @param options - Import options
 * @returns Promise that resolves when the audio file is updated
 *
 * @example
 * ```typescript
 * // Add a back cover
 * await importPictureWithType(
 *   "song.mp3",
 *   "back-cover.jpg",
 *   PictureType.BackCover,
 *   { description: "Album back cover" }
 * );
 * ```
 */
export async function importPictureWithType(
  audioPath: string,
  imagePath: string,
  type: PictureType,
  options: {
    mimeType?: string;
    description?: string;
  } = {},
): Promise<void> {
  const imageData = await readFileData(imagePath);
  
  // Detect MIME type from file extension if not provided
  let mimeType = options.mimeType;
  if (!mimeType) {
    const ext = imagePath.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
    };
    mimeType = mimeTypes[ext || ''] || 'image/jpeg';
  }
  
  const picture: Picture = {
    mimeType,
    data: imageData,
    type,
    description: options.description,
  };
  
  const modifiedBuffer = await replacePictureByType(audioPath, picture);
  await writeFileData(audioPath, modifiedBuffer);
}

/**
 * Load a picture from an image file
 *
 * @param imagePath - Path to the image file
 * @param type - Picture type (defaults to FrontCover)
 * @param options - Picture options
 * @returns Picture object ready to be applied to audio files
 *
 * @example
 * ```typescript
 * const frontCover = await loadPictureFromFile("cover.jpg");
 * const backCover = await loadPictureFromFile("back.png", PictureType.BackCover);
 * 
 * const modifiedBuffer = await applyPictures("song.mp3", [frontCover, backCover]);
 * ```
 */
export async function loadPictureFromFile(
  imagePath: string,
  type: PictureType = PictureType.FrontCover,
  options: {
    mimeType?: string;
    description?: string;
  } = {},
): Promise<Picture> {
  const data = await readFileData(imagePath);
  
  // Detect MIME type from file extension if not provided
  let mimeType = options.mimeType;
  if (!mimeType) {
    const ext = imagePath.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp',
    };
    mimeType = mimeTypes[ext || ''] || 'image/jpeg';
  }
  
  return {
    mimeType,
    data,
    type,
    description: options.description || imagePath.split('/').pop(),
  };
}

/**
 * Save a picture to an image file
 *
 * @param picture - Picture object to save
 * @param imagePath - Path where the image should be saved
 * @returns Promise that resolves when the image is saved
 *
 * @example
 * ```typescript
 * const pictures = await readPictures("song.mp3");
 * for (const picture of pictures) {
 *   await savePictureToFile(picture, `export-${picture.type}.jpg`);
 * }
 * ```
 */
export async function savePictureToFile(
  picture: Picture,
  imagePath: string,
): Promise<void> {
  await writeFileData(imagePath, picture.data);
}

/**
 * Copy cover art from one audio file to another
 *
 * @param sourcePath - Path to source audio file
 * @param targetPath - Path to target audio file (modified in place)
 * @param options - Copy options
 * @returns Promise that resolves when cover art is copied
 * @throws Error if source has no cover art
 *
 * @example
 * ```typescript
 * // Copy cover art from one file to another
 * await copyCoverArt("album/track01.mp3", "album/track02.mp3");
 * 
 * // Copy all pictures
 * await copyCoverArt("source.mp3", "target.mp3", { copyAll: true });
 * ```
 */
export async function copyCoverArt(
  sourcePath: string,
  targetPath: string,
  options: {
    copyAll?: boolean;
  } = {},
): Promise<void> {
  if (options.copyAll) {
    // Copy all pictures
    const pictures = await readPictures(sourcePath);
    if (pictures.length === 0) {
      throw new Error(`No pictures found in: ${sourcePath}`);
    }
    const modifiedBuffer = await applyPictures(targetPath, pictures);
    await writeFileData(targetPath, modifiedBuffer);
  } else {
    // Copy just the primary cover art
    const coverData = await getCoverArt(sourcePath);
    if (!coverData) {
      throw new Error(`No cover art found in: ${sourcePath}`);
    }
    
    // Find the MIME type from the source
    const pictures = await readPictures(sourcePath);
    const coverPicture = pictures.find(p => p.type === PictureType.FrontCover) || pictures[0];
    
    const modifiedBuffer = await setCoverArt(targetPath, coverData, coverPicture.mimeType);
    await writeFileData(targetPath, modifiedBuffer);
  }
}

/**
 * Check if cover art files exist for an audio file
 *
 * Looks for common cover art filenames in the same directory as the audio file.
 *
 * @param audioPath - Path to the audio file
 * @returns Object with found cover art paths
 *
 * @example
 * ```typescript
 * const covers = await findCoverArtFiles("music/album/track01.mp3");
 * if (covers.front) {
 *   await importCoverArt("music/album/track01.mp3", covers.front);
 * }
 * ```
 */
export async function findCoverArtFiles(
  audioPath: string,
): Promise<{
  front?: string;
  back?: string;
  folder?: string;
  [key: string]: string | undefined;
}> {
  const dir = audioPath.substring(0, audioPath.lastIndexOf('/') + 1);
  const commonNames = [
    'cover', 'front', 'folder', 'album', 'artwork',
    'Cover', 'Front', 'Folder', 'Album', 'Artwork',
  ];
  const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const found: Record<string, string> = {};
  
  // Check for common front cover names
  for (const name of commonNames) {
    for (const ext of extensions) {
      const path = `${dir}${name}.${ext}`;
      try {
        // Try to read a single byte to check if file exists
        const data = await readFileData(path);
        if (data.length > 0) {
          if (!found.front && ['cover', 'front', 'Cover', 'Front'].includes(name)) {
            found.front = path;
          } else if (!found.folder && ['folder', 'Folder'].includes(name)) {
            found.folder = path;
          } else {
            found[name.toLowerCase()] = path;
          }
          break; // Found this name, skip other extensions
        }
      } catch {
        // File doesn't exist, continue
      }
    }
  }
  
  // Check for back cover
  const backNames = ['back', 'Back', 'back-cover', 'Back-Cover'];
  for (const name of backNames) {
    for (const ext of extensions) {
      const path = `${dir}${name}.${ext}`;
      try {
        const data = await readFileData(path);
        if (data.length > 0) {
          found.back = path;
          break;
        }
      } catch {
        // File doesn't exist, continue
      }
    }
    if (found.back) break;
  }
  
  return found;
}