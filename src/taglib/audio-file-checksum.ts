/**
 * @fileoverview `mediaChecksum()`: a SHA-256 of a file's *encoded media
 * payload* — the bytes that are the audio, and not the tags around them — plus
 * FLAC's STREAMINFO digest passthrough. Factored out of `AudioFileImpl` so the
 * source rule below (what actually gets hashed) is stated exactly once.
 */

import { flacStreamInfoMd5, mediaRanges } from "./media-ranges.ts";
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
 * worth of work needs reading — unless the tag in front of it is larger than
 * this, which is why a window without a digest falls back to the whole file. */
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
  const overrun = ranges.find((r) => r.offset + r.length > bytes.length);
  // Two bounds, one guard: the walked total can exceed the buffer, and a single
  // range can run past its end while the total still fits — `subarray` clamps
  // that one silently, which would hash zero padding and count it in
  // `bytesHashed` on a value labelled source: "audio-payload".
  if (overrun || total > bytes.length) {
    throw new MetadataError(
      "read",
      `range walk overran the buffer (${
        overrun ? `range ${overrun.offset}+${overrun.length}` : `${total} bytes`
      } past the ${bytes.length}-byte buffer)`,
    );
  }
  // One range is already a contiguous view of the buffer — the whole-file
  // fallback, every single-`mdat` MP4, and MP3/FLAC/WAV, which walk one range —
  // so it is hashed where it lies instead of copying the file a second time.
  // The overrun guard above must stay in front of this: `subarray` clamps a
  // range past the end silently, which is exactly what that guard refuses.
  if (ranges.length === 1) {
    const only = ranges[0];
    // The view is used only when its buffer really is an `ArrayBuffer`: Web
    // Crypto takes a `BufferSource`, and a view on a shared buffer is not one
    // (`crypto.subtle.digest` throws "Argument 1 is a view on a
    // SharedArrayBuffer"). A caller can open a file from its own bytes, and
    // those bytes may sit on a `SharedArrayBuffer` the handle stores verbatim —
    // so this is a runtime test, not the cast it once was.
    const view = bytes.subarray(only.offset, only.offset + only.length);
    return view.buffer instanceof ArrayBuffer
      ? (view as Uint8Array<ArrayBuffer>)
      : new Uint8Array(view);
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
    // STREAMINFO sits at the very start of the *file*, so a partial image (which
    // always begins at offset 0) already carries it. A handle with no bytes at
    // all (WASI path mode) reads a header window first — never the file, since
    // the digest is 16 bytes.
    const windowed = source.bytes.length > 0
      ? source.bytes
      : source.path && io.readPartial
      ? await io.readPartial(source.path, STREAMINFO_WINDOW, 0)
      : undefined;
    // `flacStreamInfoMd5`, not `walkFlac`: the digest wants the marker and the
    // first block, while the walk ends the stream at the metadata chain's
    // implied end, and `flacEnd` answers an offset past the bytes in hand rather
    // than giving up (metadata-extent.ts:78-81). A chain larger than the window
    // just read — a cover picture is enough — therefore walks as "no audio
    // bytes" and carries no digest, even though the 16 bytes it wants are inside
    // that window. Seeking straight to the marker and the first block is all the
    // digest needs.
    //
    // A window that carries no digest therefore means the *marker* is out of
    // reach, not that the file has none: a prepended ID3v2 tag larger than the
    // window puts it there (a tag with cover art routinely does), so read the
    // source and try again instead of failing a file whose digest is present.
    // The source is not re-read when the window already WAS the source — the
    // caller's own bytes are the file.
    let md5 = windowed === undefined ? undefined : flacStreamInfoMd5(windowed);
    if (md5 === undefined && windowed !== source.bytes) {
      md5 = flacStreamInfoMd5(await fileBytes(source, io));
    }
    if (md5 === undefined) {
      throw new MetadataError(
        "read",
        "STREAMINFO digest unavailable",
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
