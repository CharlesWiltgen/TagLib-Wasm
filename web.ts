/**
 * Web browser utilities for cover art display and manipulation.
 *
 * @module web
 *
 * @example
 * ```typescript
 * import { pictureToDataURL, displayPicture } from "@charlesw/taglib-wasm/web";
 *
 * const pictures = await readPictures("song.mp3");
 * if (pictures.length > 0) {
 *   const dataURL = pictureToDataURL(pictures[0]);
 *   document.getElementById('cover').src = dataURL;
 * }
 * ```
 */

export * from "./src/web-utils/index.ts";
