import type { Picture } from "../types.ts";
import { readPictures } from "../simple/index.ts";

/**
 * Ensures a Uint8Array is backed by an ArrayBuffer (not SharedArrayBuffer)
 * for compatibility with Web APIs like Blob constructor.
 * Only creates a copy when necessary.
 *
 * @internal
 */
function ensureArrayBufferBacked(
  data: Uint8Array,
): Uint8Array & { buffer: ArrayBuffer } {
  if (data.buffer instanceof ArrayBuffer) {
    return data as Uint8Array & { buffer: ArrayBuffer };
  }
  const copy = new Uint8Array(data.length);
  copy.set(data);
  return copy as Uint8Array & { buffer: ArrayBuffer };
}

/**
 * Display a Picture in an HTML img element
 *
 * @param picture - Picture object from TagLib-Wasm
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
  if (imgElement.src.startsWith("blob:")) {
    URL.revokeObjectURL(imgElement.src);
  }

  const data = ensureArrayBufferBacked(picture.data);
  const blob = new Blob([data], { type: picture.mimeType });
  const objectURL = URL.createObjectURL(blob);

  imgElement.src = objectURL;

  imgElement.addEventListener("load", () => {
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
  const data = ensureArrayBufferBacked(picture.data);
  const blob = new Blob([data], { type: picture.mimeType });
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

  container.innerHTML = "";

  pictures.forEach((picture: Picture, index: number) => {
    const wrapper = document.createElement("div");
    wrapper.className = options.className ?? "picture-item";

    const img = document.createElement("img");
    displayPicture(picture, img);
    img.alt = picture.description ?? `Picture ${index + 1}`;

    if (options.onClick) {
      img.style.cursor = "pointer";
      img.addEventListener("click", () => options.onClick!(picture, index));
    }

    wrapper.appendChild(img);

    if (options.includeDescription && picture.description) {
      const caption = document.createElement("p");
      caption.textContent = picture.description;
      wrapper.appendChild(caption);
    }

    container.appendChild(wrapper);
  });
}
