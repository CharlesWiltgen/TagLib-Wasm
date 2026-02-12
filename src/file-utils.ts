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

import type { Picture, PictureType } from "./types.ts";
import { PICTURE_TYPE_VALUES } from "./types.ts";
import {
  applyCoverArt,
  applyPictures,
  readCoverArt,
  readPictures,
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
  const coverData = await readCoverArt(audioPath);
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
  type: PictureType | number,
): Promise<void> {
  const pictures = await readPictures(audioPath);
  const typeValue = typeof type === "string" ? PICTURE_TYPE_VALUES[type] : type;
  const picture = pictures.find((pic: Picture) => pic.type === typeValue);

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
// Picture type name mapping
const PICTURE_TYPE_NAMES: Record<number, string> = {
  [PICTURE_TYPE_VALUES.FrontCover]: "front-cover",
  [PICTURE_TYPE_VALUES.BackCover]: "back-cover",
  [PICTURE_TYPE_VALUES.LeafletPage]: "leaflet",
  [PICTURE_TYPE_VALUES.Media]: "media",
  [PICTURE_TYPE_VALUES.LeadArtist]: "lead-artist",
  [PICTURE_TYPE_VALUES.Artist]: "artist",
  [PICTURE_TYPE_VALUES.Conductor]: "conductor",
  [PICTURE_TYPE_VALUES.Band]: "band",
  [PICTURE_TYPE_VALUES.Composer]: "composer",
  [PICTURE_TYPE_VALUES.Lyricist]: "lyricist",
  [PICTURE_TYPE_VALUES.RecordingLocation]: "recording-location",
  [PICTURE_TYPE_VALUES.DuringRecording]: "during-recording",
  [PICTURE_TYPE_VALUES.DuringPerformance]: "during-performance",
  [PICTURE_TYPE_VALUES.MovieScreenCapture]: "screen-capture",
  [PICTURE_TYPE_VALUES.ColouredFish]: "fish",
  [PICTURE_TYPE_VALUES.Illustration]: "illustration",
  [PICTURE_TYPE_VALUES.BandLogo]: "band-logo",
  [PICTURE_TYPE_VALUES.PublisherLogo]: "publisher-logo",
};

/**
 * Generate filename for a picture
 */
function generatePictureFilename(picture: Picture, index: number): string {
  const typeName = PICTURE_TYPE_NAMES[picture.type] ?? "other";
  const ext = picture.mimeType.split("/")[1] ?? "jpg";
  return `${typeName}-${index + 1}.${ext}`;
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
  const dir = outputDir.endsWith("/") ? outputDir : outputDir + "/";

  for (let i = 0; i < pictures.length; i++) {
    const picture = pictures[i];
    const filename = options.nameFormat
      ? options.nameFormat(picture, i)
      : generatePictureFilename(picture, i);

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
    const ext = imagePath.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      "jpg": "image/jpeg",
      "jpeg": "image/jpeg",
      "png": "image/png",
      "gif": "image/gif",
      "webp": "image/webp",
      "bmp": "image/bmp",
    };
    mimeType = mimeTypes[ext ?? ""] ?? "image/jpeg";
  }

  const modifiedBuffer = await applyCoverArt(audioPath, imageData, mimeType);
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
  type: PictureType | number,
  options: {
    mimeType?: string;
    description?: string;
  } = {},
): Promise<void> {
  const imageData = await readFileData(imagePath);

  // Detect MIME type from file extension if not provided
  let mimeType = options.mimeType;
  if (!mimeType) {
    const ext = imagePath.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      "jpg": "image/jpeg",
      "jpeg": "image/jpeg",
      "png": "image/png",
      "gif": "image/gif",
      "webp": "image/webp",
      "bmp": "image/bmp",
    };
    mimeType = mimeTypes[ext ?? ""] ?? "image/jpeg";
  }

  const picture: Picture = {
    mimeType,
    data: imageData,
    type: typeof type === "string" ? PICTURE_TYPE_VALUES[type] : type,
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
  type: PictureType | number = "FrontCover",
  options: {
    mimeType?: string;
    description?: string;
  } = {},
): Promise<Picture> {
  const data = await readFileData(imagePath);

  // Detect MIME type from file extension if not provided
  let mimeType = options.mimeType;
  if (!mimeType) {
    const ext = imagePath.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      "jpg": "image/jpeg",
      "jpeg": "image/jpeg",
      "png": "image/png",
      "gif": "image/gif",
      "webp": "image/webp",
      "bmp": "image/bmp",
    };
    mimeType = mimeTypes[ext ?? ""] ?? "image/jpeg";
  }

  return {
    mimeType,
    data,
    type: typeof type === "string" ? PICTURE_TYPE_VALUES[type] : type,
    description: options.description ?? imagePath.split("/").pop(),
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
    const coverData = await readCoverArt(sourcePath);
    if (!coverData) {
      throw new Error(`No cover art found in: ${sourcePath}`);
    }

    // Find the MIME type from the source
    const pictures = await readPictures(sourcePath);
    const coverPicture = pictures.find((p: Picture) =>
      p.type === PICTURE_TYPE_VALUES.FrontCover
    ) ?? pictures[0];

    const modifiedBuffer = await applyCoverArt(
      targetPath,
      coverData,
      coverPicture.mimeType,
    );
    await writeFileData(targetPath, modifiedBuffer);
  }
}

/**
 * Check if a file exists by attempting to read it
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    const data = await readFileData(path);
    return data.length > 0;
  } catch {
    return false;
  }
}

/**
 * Find a cover art file with given names and extensions
 */
async function findCoverFile(
  dir: string,
  names: string[],
  extensions: string[],
): Promise<string | undefined> {
  for (const name of names) {
    for (const ext of extensions) {
      const path = `${dir}${name}.${ext}`;
      if (await fileExists(path)) {
        return path;
      }
    }
  }
  return undefined;
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
  const dir = audioPath.substring(0, audioPath.lastIndexOf("/") + 1);
  const extensions = ["jpg", "jpeg", "png", "gif", "webp"];
  const found: Record<string, string> = {};

  // Search for front cover
  const frontPath = await findCoverFile(
    dir,
    ["cover", "front", "Cover", "Front"],
    extensions,
  );
  if (frontPath) found.front = frontPath;

  // Search for folder image
  const folderPath = await findCoverFile(
    dir,
    ["folder", "Folder"],
    extensions,
  );
  if (folderPath) found.folder = folderPath;

  // Search for other common artwork names
  const otherNames = ["album", "artwork", "Album", "Artwork"];
  for (const name of otherNames) {
    const path = await findCoverFile(dir, [name], extensions);
    if (path) found[name.toLowerCase()] = path;
  }

  // Search for back cover
  const backPath = await findCoverFile(
    dir,
    ["back", "Back", "back-cover", "Back-Cover"],
    extensions,
  );
  if (backPath) found.back = backPath;

  return found;
}
