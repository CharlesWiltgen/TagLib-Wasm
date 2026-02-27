import type { Picture, PictureType } from "../types.ts";
import { applyPictures } from "../simple/index.ts";
import { dataURLToPicture } from "./data-url.ts";

/**
 * Set cover art from an HTML canvas element
 *
 * @param file - File path, Uint8Array buffer, ArrayBuffer, or File object
 * @param canvas - HTMLCanvasElement containing the image
 * @param options - Options for image format and quality
 * @returns Modified file buffer with cover art from canvas
 *
 * @example
 * ```typescript
 * const canvas = document.getElementById('albumArt') as HTMLCanvasElement;
 * const modifiedBuffer = await setCoverArtFromCanvas("song.mp3", canvas, {
 *   format: 'image/jpeg',
 *   quality: 0.9
 * });
 * ```
 */
export async function setCoverArtFromCanvas(
  file: string | Uint8Array | ArrayBuffer | File,
  canvas: HTMLCanvasElement,
  options: {
    format?: "image/jpeg" | "image/png" | "image/webp";
    quality?: number;
    type?: PictureType;
    description?: string;
  } = {},
): Promise<Uint8Array> {
  const {
    format = "image/jpeg",
    quality = 0.92,
    type = "FrontCover",
    description = "Front Cover",
  } = options;

  const dataURL = canvas.toDataURL(format, quality);
  const picture = dataURLToPicture(dataURL, type, description);

  return applyPictures(file, [picture]);
}

/**
 * Convert canvas to Picture object using blob for better performance
 *
 * This is more efficient than toDataURL for large images as it avoids
 * the base64 encoding/decoding step.
 *
 * @param canvas - HTMLCanvasElement containing the image
 * @param options - Options for image format and quality
 * @returns Promise resolving to Picture object
 *
 * @example
 * ```typescript
 * const canvas = document.getElementById('albumArt') as HTMLCanvasElement;
 * const picture = await canvasToPicture(canvas, {
 *   format: 'image/png',
 *   type: PictureType.BackCover
 * });
 * ```
 */
export async function canvasToPicture(
  canvas: HTMLCanvasElement,
  options: {
    format?: "image/jpeg" | "image/png" | "image/webp";
    quality?: number;
    type?: PictureType;
    description?: string;
  } = {},
): Promise<Picture> {
  const {
    format = "image/jpeg",
    quality = 0.92,
    type = "FrontCover",
    description,
  } = options;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("Failed to convert canvas to blob"));
          return;
        }

        const arrayBuffer = await blob.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        resolve({
          mimeType: format,
          data,
          type,
          description,
        });
      },
      format,
      quality,
    );
  });
}

/**
 * Load an image file into a Picture object
 *
 * @param file - File object from <input type="file"> or drag-and-drop
 * @param type - Picture type (defaults to FrontCover)
 * @param description - Optional description
 * @returns Promise resolving to Picture object
 *
 * @example
 * ```typescript
 * // From file input
 * const input = document.getElementById('fileInput') as HTMLInputElement;
 * input.addEventListener('change', async (e) => {
 *   const file = e.target.files[0];
 *   const picture = await imageFileToPicture(file);
 *   const modifiedBuffer = await applyPictures("song.mp3", [picture]);
 * });
 * ```
 */
export async function imageFileToPicture(
  file: File,
  type: PictureType = "FrontCover",
  description?: string,
): Promise<Picture> {
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  return {
    mimeType: file.type,
    data,
    type,
    description: description ?? file.name,
  };
}
