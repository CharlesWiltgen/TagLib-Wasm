import {
  getFileSize,
  readFileData,
  readPartialFileData,
} from "../utils/file.ts";

/**
 * Load audio data from various sources, with optional partial loading.
 * @internal Used by TagLib.open()
 */
export async function loadAudioData(
  input: string | ArrayBuffer | Uint8Array | File,
  opts: { partial: boolean; maxHeaderSize: number; maxFooterSize: number },
): Promise<{ data: Uint8Array; isPartiallyLoaded: boolean }> {
  if (opts.partial && typeof File !== "undefined" && input instanceof File) {
    const headerSize = Math.min(opts.maxHeaderSize, input.size);
    const footerSize = Math.min(opts.maxFooterSize, input.size);

    if (input.size <= headerSize + footerSize) {
      return { data: await readFileData(input), isPartiallyLoaded: false };
    }

    const header = await input.slice(0, headerSize).arrayBuffer();
    const footerStart = Math.max(0, input.size - footerSize);
    const footer = await input.slice(footerStart).arrayBuffer();
    const combined = new Uint8Array(header.byteLength + footer.byteLength);
    combined.set(new Uint8Array(header), 0);
    combined.set(new Uint8Array(footer), header.byteLength);
    return { data: combined, isPartiallyLoaded: true };
  }

  if (opts.partial && typeof input === "string") {
    const fileSize = await getFileSize(input);
    if (fileSize > opts.maxHeaderSize + opts.maxFooterSize) {
      const data = await readPartialFileData(
        input,
        opts.maxHeaderSize,
        opts.maxFooterSize,
      );
      return { data, isPartiallyLoaded: true };
    }
    return { data: await readFileData(input), isPartiallyLoaded: false };
  }

  return { data: await readFileData(input), isPartiallyLoaded: false };
}
