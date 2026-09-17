/**
 * @fileoverview `mediaChecksum()`: a SHA-256 of a file's *encoded media
 * payload* — the bytes that are the audio, and not the tags around them — plus
 * FLAC's STREAMINFO digest passthrough. Factored out of `AudioFileImpl` so the
 * source rule below (what actually gets hashed) is stated exactly once.
 */

import { mediaRanges, walkFlac } from "./media-ranges.ts";
import type { ByteRange } from "./media-ranges.ts";
import type { PlatformIO } from "../runtime/platform-io.ts";
import { MetadataError, UnsupportedFormatError } from "../errors.ts";

export type MediaChecksum =
  | {
    source: "audio-payload" | "file";
    algorithm: "sha256";
    hex: string;
    bytesHashed: number;
  }
  | {
    source: "flac-streaminfo-md5";
    algorithm: "md5";
    hex: string;
    bytesHashed: 16;
  };

export interface MediaChecksumOptions {
  basis?: "encoded" | "pcm";
}

/** The literal a checksum's `source` field carries, so a consumer can hold one
 * without restating the values. */
export type ChecksumSource = MediaChecksum["source"];

/** The algorithm any returned checksum can carry — narrowed by `source`. */
export type ChecksumAlgorithm = MediaChecksum["algorithm"];

/**
 * What the checksum needs from the open handle — module-internal, and not
 * re-exported from either entry point (`ChecksumSource` above is the public name,
 * and a handle descriptor must not shadow it).
 */
interface ChecksumHandleSource {
  /** The bytes the handle holds — a full file, a partial-load window image, or
   * nothing at all when the data lives on disk (WASI path mode). */
  bytes: Uint8Array;
  /** The path, when the handle was opened from one. */
  path?: string;
  /** The File/Blob, when the handle was opened from one. */
  blob?: Blob;
  /** True when `bytes` is a spliced header+footer image rather than the file.
   * Must be captured when the handle is created: `saveToFile()` clears the
   * instance's own flag while the bytes stay spliced. */
  partiallyLoaded: boolean;
}

/** The header window a path-mode handle reads for `basis: "pcm"`: STREAMINFO is
 * a FLAC file's first metadata block, so nothing else in a 16-byte digest's
 * worth of work needs reading. */
const STREAMINFO_WINDOW = 65536;

/**
 * The file's bytes — the checksum describes the file at its source, so the
 * source wins over whatever the handle holds in memory:
 *
 * 1. a path is read (WASI path mode keeps nothing in memory, and a partial handle
 *    holds a spliced header+footer image, not the file);
 * 2. a Blob/File is read (a partial File has no path — this is the only way back);
 * 3. the caller's own bytes are used only when the handle could not have spliced
 *    them, i.e. no path, no blob, and not partial (Uint8Array/ArrayBuffer inputs
 *    have no partial mode by construction);
 * 4. otherwise throw. That last case is real: saving a *partial* File handle drops
 *    both its original source and its partial flag (`audio-file-impl.ts:155-156`)
 *    while the in-memory bytes stay a spliced image — returning them would hash a
 *    truncated file and label it source: "audio-payload".
 *
 * The read is whole-file on purpose: ranges cannot be derived from a spliced
 * image (the MPEG and MP4 walks need every frame and atom), and the digest needs
 * the payload anyway — so the only extra bytes are the container's tag regions.
 */
async function fileBytes(
  source: ChecksumHandleSource,
  io: PlatformIO,
): Promise<Uint8Array> {
  if (source.path) return await io.readFile(source.path);
  if (source.blob) return new Uint8Array(await source.blob.arrayBuffer());
  if (!source.partiallyLoaded && source.bytes.length > 0) return source.bytes;
  throw new MetadataError(
    "read",
    "the handle holds no file bytes and has no readable source; a partial handle that has been saved drops its source — checksum the saved path instead",
    "mediaChecksum",
  );
}

/** Web Crypto has no streaming digest, so the payload is materialized once —
 * bounded by the payload the caller asked us to hash. The return is annotated
 * because digest() takes a `BufferSource` and a bare `Uint8Array` widens to
 * ArrayBufferLike (shared buffers are not a BufferSource). */
function joinRanges(
  bytes: Uint8Array,
  ranges: ByteRange[],
): Uint8Array<ArrayBuffer> {
  const total = ranges.reduce((n, r) => n + r.length, 0);
  // The walks reject ranges past the end of the buffer; this is the backstop
  // that stops a future walk from hashing zero padding while bytesHashed counts
  // it, on a value labelled source: "audio-payload".
  if (total > bytes.length) {
    throw new MetadataError(
      "read",
      `range walk overran the buffer (${total} > ${bytes.length})`,
      "mediaChecksum",
    );
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const r of ranges) {
    out.set(bytes.subarray(r.offset, r.offset + r.length), at);
    at += r.length;
  }
  return out;
}

export async function mediaChecksum(
  source: ChecksumHandleSource,
  format: string,
  io: PlatformIO,
  options: MediaChecksumOptions = {},
): Promise<MediaChecksum> {
  if (options.basis === "pcm") {
    // Case-insensitive like `mediaRanges`: the AudioFile reports "FLAC" while
    // callers pass the extension ("flac"), and a case-sensitive compare here
    // would reject a FLAC file the walks handle without complaint.
    if (format.toUpperCase() !== "FLAC") {
      throw new UnsupportedFormatError(format, ["FLAC"], {
        operation: "media checksum (basis: pcm)",
      });
    }
    // STREAMINFO sits at the very start of the file, so a partial image already
    // carries it; a handle with no bytes at all (WASI path mode) reads a header
    // window — never the file, since the digest is 16 bytes.
    const bytes = source.bytes.length > 0
      ? source.bytes
      : source.path && io.readPartial
      ? await io.readPartial(source.path, STREAMINFO_WINDOW, 0)
      : await fileBytes(source, io);
    const md5 = walkFlac(bytes).streamInfoMd5;
    if (md5 === undefined) {
      throw new MetadataError(
        "read",
        "STREAMINFO digest unavailable",
        "mediaChecksum",
      );
    }
    return {
      source: "flac-streaminfo-md5",
      algorithm: "md5",
      hex: md5,
      bytesHashed: 16,
    };
  }

  const bytes = await fileBytes(source, io);
  // A fallback already carries the whole file as one range, so this is also the
  // whole-file path — `kind` is the only authority on which it was.
  const walk = mediaRanges(format, bytes);
  const payload = joinRanges(bytes, walk.ranges);
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", payload),
  );
  let hex = "";
  for (const byte of digest) hex += byte.toString(16).padStart(2, "0");
  return {
    source: walk.kind === "ranges" ? "audio-payload" : "file",
    algorithm: "sha256",
    hex,
    bytesHashed: payload.length,
  };
}
