import { MetadataError } from "../errors/classes.ts";
import type { Picture, PictureType } from "../types.ts";
import { readCoverArt, readPictures } from "../simple/index.ts";
import { writeFileData } from "../utils/write.ts";
import { generatePictureFilename } from "./mime-detection.ts";

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
    throw new MetadataError("read", `No cover art found. Path: ${audioPath}`);
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
  const picture = pictures.find((pic: Picture) => pic.type === type);

  if (!picture) {
    throw new MetadataError(
      "read",
      `No picture of type ${type} found. Path: ${audioPath}`,
    );
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
