/**
 * @fileoverview Web browser utilities for working with cover art in TagLib-Wasm
 *
 * This module provides browser-specific helpers for integrating TagLib-Wasm
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

export { dataURLToPicture, pictureToDataURL } from "./data-url.ts";
export {
  canvasToPicture,
  imageFileToPicture,
  setCoverArtFromCanvas,
} from "./canvas.ts";
export {
  createPictureDownloadURL,
  createPictureGallery,
  displayPicture,
} from "./dom-integration.ts";
