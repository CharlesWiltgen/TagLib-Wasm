import {
  getFileSize,
  readFileData,
  readPartialFileData,
} from "../utils/file.ts";
import {
  metadataFitsInHeader,
  trailerFitsInFooter,
} from "./metadata-extent.ts";

type LoadResult = { data: Uint8Array; isPartiallyLoaded: boolean };
type LoadOptions = {
  partial: boolean;
  maxHeaderSize: number;
  maxFooterSize: number;
};

async function loadFull(
  input: string | ArrayBuffer | Uint8Array | File,
): Promise<LoadResult> {
  return { data: await readFileData(input), isPartiallyLoaded: false };
}

/** Partial load for a browser-style File: header + footer windows. */
async function loadPartialFile(
  input: File,
  opts: LoadOptions,
): Promise<LoadResult> {
  const headerSize = Math.min(opts.maxHeaderSize, input.size);
  const footerSize = Math.min(opts.maxFooterSize, input.size);

  if (input.size <= headerSize + footerSize) return loadFull(input);

  const header = new Uint8Array(await input.slice(0, headerSize).arrayBuffer());
  // Splicing is only sound when the metadata ends inside the header window;
  // otherwise the tag is cut mid-structure and footer bytes land on the cut.
  if (!metadataFitsInHeader(header, headerSize)) return loadFull(input);

  const footerStart = Math.max(0, input.size - footerSize);
  const footer = new Uint8Array(await input.slice(footerStart).arrayBuffer());
  // The header check says nothing about trailer metadata; an APE tag larger
  // than the footer window is spliced so TagLib reads nothing at all.
  if (!trailerFitsInFooter(footer, footerSize)) return loadFull(input);

  const combined = new Uint8Array(header.byteLength + footer.byteLength);
  combined.set(header, 0);
  combined.set(footer, header.byteLength);
  return { data: combined, isPartiallyLoaded: true };
}

/** Partial load for a path: one ranged read covering both windows. */
async function loadPartialPath(
  input: string,
  opts: LoadOptions,
): Promise<LoadResult> {
  const fileSize = await getFileSize(input);
  if (fileSize > opts.maxHeaderSize + opts.maxFooterSize) {
    const data = await readPartialFileData(
      input,
      opts.maxHeaderSize,
      opts.maxFooterSize,
    );
    // Same check as the File branch, run against the header half of what was
    // just read. A file whose metadata overruns the window costs one wasted
    // partial read and is then loaded in full — the alternative is handing
    // TagLib a spliced image it silently misreads (taglib-f5hp).
    // Both ends must hold: the header check cannot see trailer metadata, and
    // an oversized APE tag silently loses every value (taglib-f5hp review).
    if (
      metadataFitsInHeader(data, opts.maxHeaderSize) &&
      trailerFitsInFooter(data, opts.maxFooterSize)
    ) {
      return { data, isPartiallyLoaded: true };
    }
  }
  return loadFull(input);
}

/**
 * Load audio data from various sources, with optional partial loading.
 * @internal Used by TagLib.open()
 */
export async function loadAudioData(
  input: string | ArrayBuffer | Uint8Array | File,
  opts: LoadOptions,
): Promise<LoadResult> {
  if (!opts.partial) return loadFull(input);
  if (typeof File !== "undefined" && input instanceof File) {
    return loadPartialFile(input, opts);
  }
  if (typeof input === "string") return loadPartialPath(input, opts);
  return loadFull(input);
}
