import type { Picture, PictureType } from "../types.ts";
import { PICTURE_TYPE_VALUES } from "../types.ts";
import { InvalidFormatError } from "../errors/classes.ts";

/**
 * Convert a Picture object to a data URL for display in web browsers
 *
 * @param picture - Picture object from TagLib-Wasm
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
  const base64 = btoa(String.fromCharCode(...Array.from(picture.data)));
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
  type: PictureType | number = "FrontCover",
  description?: string,
): Picture {
  const regex = /^data:([^;]+);base64,(.+)$/;
  const matches = regex.exec(dataURL);
  if (!matches) {
    throw new InvalidFormatError("Invalid data URL format");
  }

  const [, mimeType, base64] = matches;

  const binaryString = atob(base64);
  const data = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    data[i] = binaryString.charCodeAt(i);
  }

  return {
    mimeType,
    data,
    type: typeof type === "string" ? PICTURE_TYPE_VALUES[type] : type,
    description,
  };
}
