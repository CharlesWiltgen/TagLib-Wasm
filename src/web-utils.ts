/**
 * @fileoverview Web browser utilities for working with cover art in taglib-wasm
 *
 * This module provides browser-specific helpers for integrating taglib-wasm
 * with web applications, including canvas integration and data URL support.
 *
 * @example
 * ```typescript
 * import { pictureToDataURL, setCoverArtFromCanvas } from "taglib-wasm/web-utils";
 *
 * // Display cover art in an <img> element
 * const pictures = await readPictures("song.mp3");
 * if (pictures.length > 0) {
 *   const dataURL = pictureToDataURL(pictures[0]);
 *   document.getElementById('cover').src = dataURL;
 * }
 *
 * // Set cover art from a canvas
 * const canvas = document.getElementById('myCanvas') as HTMLCanvasElement;
 * const modifiedBuffer = await setCoverArtFromCanvas("song.mp3", canvas);
 * ```
 */

import type { Picture } from "./types.ts";
import { PictureType } from "./types.ts";
import { applyPictures, readPictures } from "./simple.ts";

/**
 * Convert a Picture object to a data URL for display in web browsers
 *
 * @param picture - Picture object from taglib-wasm
 * @returns Data URL string that can be used as src for <img> elements
 *
 * @example
 * ```typescript
 * const pictures = await readPictures("song.mp3");
 * const imgElement = document.getElementById('coverArt') as HTMLImageElement;
 * imgElement.src = pictureToDataURL(pictures[0]);
 * ```
 */
export function pictureToDataURL(picture: Picture): string {
  // Convert Uint8Array to base64
  const base64 = btoa(String.fromCharCode(...picture.data));
  return `data:${picture.mimeType};base64,${base64}`;
}

/**
 * Convert a data URL to a Picture object
 *
 * @param dataURL - Data URL string (e.g., "data:image/jpeg;base64,...")
 * @param type - Picture type (defaults to FrontCover)
 * @param description - Optional description
 * @returns Picture object
 *
 * @example
 * ```typescript
 * const dataURL = canvas.toDataURL('image/jpeg');
 * const picture = dataURLToPicture(dataURL, PictureType.FrontCover);
 * const modifiedBuffer = await applyPictures("song.mp3", [picture]);
 * ```
 */
export function dataURLToPicture(
  dataURL: string,
  type: PictureType = PictureType.FrontCover,
  description?: string,
): Picture {
  // Parse data URL
  const matches = dataURL.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid data URL format");
  }

  const [, mimeType, base64] = matches;
  
  // Convert base64 to Uint8Array
  const binaryString = atob(base64);
  const data = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    data[i] = binaryString.charCodeAt(i);
  }

  return {
    mimeType,
    data,
    type,
    description,
  };
}

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
    format?: 'image/jpeg' | 'image/png' | 'image/webp';
    quality?: number;
    type?: PictureType;
    description?: string;
  } = {},
): Promise<Uint8Array> {
  const {
    format = 'image/jpeg',
    quality = 0.92,
    type = PictureType.FrontCover,
    description = "Front Cover",
  } = options;

  // Convert canvas to data URL
  const dataURL = canvas.toDataURL(format, quality);
  
  // Convert to Picture object
  const picture = dataURLToPicture(dataURL, type, description);
  
  // Apply to file
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
    format?: 'image/jpeg' | 'image/png' | 'image/webp';
    quality?: number;
    type?: PictureType;
    description?: string;
  } = {},
): Promise<Picture> {
  const {
    format = 'image/jpeg',
    quality = 0.92,
    type = PictureType.FrontCover,
    description,
  } = options;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("Failed to convert canvas to blob"));
          return;
        }

        // Convert blob to Uint8Array
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
  type: PictureType = PictureType.FrontCover,
  description?: string,
): Promise<Picture> {
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  return {
    mimeType: file.type,
    data,
    type,
    description: description || file.name,
  };
}

/**
 * Display a Picture in an HTML img element
 *
 * @param picture - Picture object from taglib-wasm
 * @param imgElement - HTMLImageElement to display the picture in
 *
 * @example
 * ```typescript
 * const pictures = await readPictures("song.mp3");
 * const img = document.getElementById('coverArt') as HTMLImageElement;
 * displayPicture(pictures[0], img);
 * ```
 */
export function displayPicture(
  picture: Picture,
  imgElement: HTMLImageElement,
): void {
  // Clean up previous object URL if any
  if (imgElement.src.startsWith('blob:')) {
    URL.revokeObjectURL(imgElement.src);
  }

  // Create blob and object URL
  const blob = new Blob([picture.data], { type: picture.mimeType });
  const objectURL = URL.createObjectURL(blob);
  
  // Set the src
  imgElement.src = objectURL;
  
  // Clean up object URL when image is no longer needed
  imgElement.addEventListener('load', () => {
    // Keep the URL alive for a bit to ensure image is rendered
    setTimeout(() => URL.revokeObjectURL(objectURL), 100);
  }, { once: true });
}

/**
 * Create a download link for a Picture
 *
 * @param picture - Picture object to download
 * @param filename - Suggested filename for download
 * @returns Temporary download URL (remember to revoke it after use)
 *
 * @example
 * ```typescript
 * const pictures = await readPictures("song.mp3");
 * const downloadUrl = createPictureDownloadURL(pictures[0], "cover.jpg");
 * 
 * const link = document.createElement('a');
 * link.href = downloadUrl;
 * link.download = "cover.jpg";
 * link.click();
 * 
 * // Clean up
 * URL.revokeObjectURL(downloadUrl);
 * ```
 */
export function createPictureDownloadURL(
  picture: Picture,
  filename: string = "cover",
): string {
  const blob = new Blob([picture.data], { type: picture.mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Extract all pictures and create a gallery
 *
 * @param file - Audio file to extract pictures from
 * @param container - HTML element to append gallery items to
 * @param options - Gallery display options
 *
 * @example
 * ```typescript
 * const galleryDiv = document.getElementById('pictureGallery');
 * await createPictureGallery("song.mp3", galleryDiv, {
 *   className: 'album-art',
 *   includeDescription: true
 * });
 * ```
 */
export async function createPictureGallery(
  file: string | Uint8Array | ArrayBuffer | File,
  container: HTMLElement,
  options: {
    className?: string;
    includeDescription?: boolean;
    onClick?: (picture: Picture, index: number) => void;
  } = {},
): Promise<void> {
  const pictures = await readPictures(file);
  
  // Clear container
  container.innerHTML = '';
  
  pictures.forEach((picture, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = options.className || 'picture-item';
    
    const img = document.createElement('img');
    displayPicture(picture, img);
    img.alt = picture.description || `Picture ${index + 1}`;
    
    if (options.onClick) {
      img.style.cursor = 'pointer';
      img.addEventListener('click', () => options.onClick!(picture, index));
    }
    
    wrapper.appendChild(img);
    
    if (options.includeDescription && picture.description) {
      const caption = document.createElement('p');
      caption.textContent = picture.description;
      wrapper.appendChild(caption);
    }
    
    container.appendChild(wrapper);
  });
}