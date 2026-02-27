import type { AudioFileInput, Picture, PictureType } from "../types.ts";
import { FileOperationError, InvalidFormatError } from "../errors.ts";
import { getTagLib } from "./config.ts";

/**
 * Reads all embedded pictures from an audio file.
 *
 * @param file - File path, Uint8Array, ArrayBuffer, or File object
 * @returns Array of all pictures embedded in the file
 * @throws {TagLibInitializationError} If the Wasm module fails to initialize
 * @throws {InvalidFormatError} If the file is corrupted or in an unsupported format
 */
export async function readPictures(
  file: AudioFileInput,
): Promise<Picture[]> {
  const taglib = await getTagLib();
  const audioFile = await taglib.open(file);
  try {
    if (!audioFile.isValid()) {
      throw new InvalidFormatError(
        "File may be corrupted or in an unsupported format",
      );
    }

    return audioFile.getPictures();
  } finally {
    audioFile.dispose();
  }
}

/**
 * Replaces all embedded pictures in an audio file and returns the modified content as a buffer.
 *
 * @param file - File path, Uint8Array, ArrayBuffer, or File object
 * @param pictures - Complete set of pictures to embed; replaces any existing pictures
 * @returns Modified audio file contents with the updated picture set
 * @throws {TagLibInitializationError} If the Wasm module fails to initialize
 * @throws {InvalidFormatError} If the file is corrupted or in an unsupported format
 * @throws {FileOperationError} If saving the modified picture data fails
 */
export async function applyPictures(
  file: AudioFileInput,
  pictures: Picture[],
): Promise<Uint8Array> {
  const taglib = await getTagLib();
  const audioFile = await taglib.open(file);
  try {
    if (!audioFile.isValid()) {
      throw new InvalidFormatError(
        "File may be corrupted or in an unsupported format",
      );
    }

    audioFile.setPictures(pictures);

    if (!audioFile.save()) {
      throw new FileOperationError(
        "save",
        "Failed to save picture changes. The file may be read-only or corrupted.",
      );
    }

    return audioFile.getFileBuffer();
  } finally {
    audioFile.dispose();
  }
}

/**
 * Appends a single picture to an audio file's existing embedded pictures.
 *
 * @param file - File path, Uint8Array, ArrayBuffer, or File object
 * @param picture - Picture to append to the file
 * @returns Modified audio file contents with the new picture added
 * @throws {TagLibInitializationError} If the Wasm module fails to initialize
 * @throws {InvalidFormatError} If the file is corrupted or in an unsupported format
 * @throws {FileOperationError} If saving the modified picture data fails
 */
export async function addPicture(
  file: AudioFileInput,
  picture: Picture,
): Promise<Uint8Array> {
  const taglib = await getTagLib();
  const audioFile = await taglib.open(file);
  try {
    if (!audioFile.isValid()) {
      throw new InvalidFormatError(
        "File may be corrupted or in an unsupported format",
      );
    }

    audioFile.addPicture(picture);

    if (!audioFile.save()) {
      throw new FileOperationError(
        "save",
        "Failed to save picture changes. The file may be read-only or corrupted.",
      );
    }

    return audioFile.getFileBuffer();
  } finally {
    audioFile.dispose();
  }
}

/**
 * Removes all embedded pictures from an audio file and returns the modified content as a buffer.
 *
 * @param file - File path, Uint8Array, ArrayBuffer, or File object
 * @returns Modified audio file contents with all pictures removed
 * @throws {TagLibInitializationError} If the Wasm module fails to initialize
 * @throws {InvalidFormatError} If the file is corrupted or in an unsupported format
 * @throws {FileOperationError} If saving the modified file fails
 */
export async function clearPictures(
  file: AudioFileInput,
): Promise<Uint8Array> {
  return applyPictures(file, []);
}

/**
 * Reads the front cover art from an audio file, falling back to the first embedded picture.
 *
 * @param file - File path, Uint8Array, ArrayBuffer, or File object
 * @returns Raw image bytes for the cover art, or `undefined` if no pictures are embedded
 * @throws {TagLibInitializationError} If the Wasm module fails to initialize
 * @throws {InvalidFormatError} If the file is corrupted or in an unsupported format
 */
export async function readCoverArt(
  file: AudioFileInput,
): Promise<Uint8Array | undefined> {
  const pictures = await readPictures(file);
  if (pictures.length === 0) {
    return undefined;
  }

  const frontCover = pictures.find((pic) => pic.type === "FrontCover");
  if (frontCover) {
    return frontCover.data;
  }

  return pictures[0].data;
}

/**
 * Replaces all embedded pictures with a single front cover image and returns the modified content as a buffer.
 *
 * @param file - File path, Uint8Array, ArrayBuffer, or File object
 * @param imageData - Raw image bytes to embed as the front cover
 * @param mimeType - MIME type of the image (e.g., `"image/jpeg"`, `"image/png"`)
 * @returns Modified audio file contents with the new cover art
 * @throws {TagLibInitializationError} If the Wasm module fails to initialize
 * @throws {InvalidFormatError} If the file is corrupted or in an unsupported format
 * @throws {FileOperationError} If saving the modified picture data fails
 */
export async function applyCoverArt(
  file: AudioFileInput,
  imageData: Uint8Array,
  mimeType: string,
): Promise<Uint8Array> {
  const picture: Picture = {
    mimeType,
    data: imageData,
    type: "FrontCover",
    description: "Front Cover",
  };
  return applyPictures(file, [picture]);
}

/**
 * Finds the first picture of a given type from an array of pictures.
 *
 * @param pictures - Array of pictures to search
 * @param type - Picture type to find (e.g., `"FrontCover"`, `"BackCover"`)
 * @returns The first matching picture, or `undefined` if none is found
 */
export function findPictureByType(
  pictures: Picture[],
  type: PictureType,
): Picture | undefined {
  return pictures.find((pic) => pic.type === type);
}

/**
 * Replaces all pictures of a given type with a new picture and returns the modified content as a buffer.
 *
 * @param file - File path, Uint8Array, ArrayBuffer, or File object
 * @param newPicture - Replacement picture; its `type` determines which existing pictures are removed
 * @returns Modified audio file contents with the updated picture
 * @throws {TagLibInitializationError} If the Wasm module fails to initialize
 * @throws {InvalidFormatError} If the file is corrupted or in an unsupported format
 * @throws {FileOperationError} If saving the modified picture data fails
 */
export async function replacePictureByType(
  file: AudioFileInput,
  newPicture: Picture,
): Promise<Uint8Array> {
  const pictures = await readPictures(file);

  const filteredPictures = pictures.filter((pic) =>
    pic.type !== newPicture.type
  );

  filteredPictures.push(newPicture);

  return applyPictures(file, filteredPictures);
}

/**
 * Reads picture metadata (type, MIME type, description, and size) without returning raw image data.
 *
 * @param file - File path, Uint8Array, ArrayBuffer, or File object
 * @returns Array of metadata objects for each embedded picture; `size` is the byte length of the image data
 * @throws {TagLibInitializationError} If the Wasm module fails to initialize
 * @throws {InvalidFormatError} If the file is corrupted or in an unsupported format
 */
export async function readPictureMetadata(
  file: AudioFileInput,
): Promise<
  Array<{
    type: PictureType;
    mimeType: string;
    description?: string;
    size: number;
  }>
> {
  const pictures = await readPictures(file);
  return pictures.map((pic) => ({
    type: pic.type,
    mimeType: pic.mimeType,
    description: pic.description,
    size: pic.data.length,
  }));
}
