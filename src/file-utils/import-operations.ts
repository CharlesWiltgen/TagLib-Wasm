import type { Picture, PictureType } from "../types.ts";
import { applyCoverArt, replacePictureByType } from "../simple/index.ts";
import { readFileData } from "../utils/file.ts";
import { writeFileData } from "../utils/write.ts";
import { detectMimeType } from "./mime-detection.ts";

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
  const mimeType = detectMimeType(imagePath, options.mimeType);

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
  type: PictureType,
  options: {
    mimeType?: string;
    description?: string;
  } = {},
): Promise<void> {
  const imageData = await readFileData(imagePath);
  const mimeType = detectMimeType(imagePath, options.mimeType);

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
  type: PictureType = "FrontCover",
  options: {
    mimeType?: string;
    description?: string;
  } = {},
): Promise<Picture> {
  const data = await readFileData(imagePath);
  const mimeType = detectMimeType(imagePath, options.mimeType);

  return {
    mimeType,
    data,
    type,
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
