import {
  flacAudioStart,
  flacMarkerOffset,
  id3v2End,
  mpegFrameLength,
} from "./metadata-extent.ts";

export interface ByteRange {
  offset: number;
  length: number;
}

export interface RangeWalk {
  kind: "ranges" | "fallback";
  ranges: ByteRange[];
  detail: string;
}

const decoder = new TextDecoder();
const text = (b: Uint8Array, o: number, n: number) =>
  decoder.decode(b.subarray(o, o + n));

/** Every walk's "I cannot vouch for this" answer: the caller then hashes the
 * whole file and reports source: "file". */
const fallback = (detail: string): RangeWalk => ({
  kind: "fallback",
  ranges: [],
  detail,
});

/**
 * ADTS (raw AAC) frame length: 13 bits spanning bytes 3..5, header included.
 * Syncword 0xFFF plus the layer bits that must be zero — which is exactly the
 * header `mpegFrameLength` rejects (metadata-extent.ts returns 0 for
 * `layer === 0`), so this is a rule of its own rather than a variant of it.
 */
function adtsFrameLength(bytes: Uint8Array, at: number): number {
  if (bytes.length < at + 7) return 0;
  if (bytes[at] !== 0xFF || (bytes[at + 1] & 0xF6) !== 0xF0) return 0;
  const length = ((bytes[at + 3] & 0x03) << 11) | (bytes[at + 4] << 3) |
    (bytes[at + 5] >> 5);
  return length >= 7 ? length : 0;
}

/** The frame length either rule recognises at `at`, or 0. */
const frameLengthAt = (bytes: Uint8Array, at: number): number =>
  mpegFrameLength(bytes, at) || adtsFrameLength(bytes, at);

/**
 * Start offset of a trailing tag run (ID3v1 and/or APEv2), scanning inward.
 * TagLib ends a FLAC stream at its ID3v1 location for the same reason.
 */
export function trailingTagStart(
  bytes: Uint8Array,
  end = bytes.length,
): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // `view` spans exactly `bytes`, so an `end` past the buffer would make the
  // APEv2 reads below throw while the ID3v1 subarray path silently clamps.
  let at = Math.max(0, Math.min(end, bytes.length));
  for (;;) {
    if (at >= 128 && text(bytes, at - 128, 3) === "TAG") {
      at -= 128;
      continue;
    }
    if (at >= 32 && text(bytes, at - 32, 8) === "APETAGEX") {
      const size = view.getUint32(at - 32 + 12, true); // includes footer, excludes header
      const flags = view.getUint32(at - 32 + 20, true);
      const start = at - size - ((flags & 0x80000000) !== 0 ? 32 : 0);
      if (start < 0 || start >= at) return at;
      at = start;
      continue;
    }
    return at;
  }
}

/**
 * First frame: skip ID3v2, then require two consecutive plausible frames.
 * The scan is bounded to 64 KiB past the tag: a file whose audio does not
 * start there is not one whose offsets this walk may vouch for, and an
 * unbounded hunt turns a junk buffer into a quadratic scan.
 */
function firstFrame(bytes: Uint8Array): number {
  const from = id3v2End(bytes) ?? 0;
  const limit = Math.min(bytes.length - 6, from + 65536);
  for (let o = from; o < limit; o++) {
    const len = frameLengthAt(bytes, o);
    if (len > 0 && frameLengthAt(bytes, o + len) > 0) return o;
  }
  return -1;
}

/**
 * Forward walk from the first frame to the last: the authority for where the
 * payload ends, O(frames).
 *
 * There is deliberately no backward scan to cross-check it. The spike used one
 * to derive the boundary rule — a reverse scan is O(payload) per file, and a
 * candidate that merely "fits inside" the payload is not the last frame, because
 * a false sync can sit within the last frame's own payload (measured on
 * kiss-snippet.mp3: an offer at 84558+72 inside the real frame ending at 85226).
 * The rule that survived is "stop on the first frame that would cross the
 * boundary": the payload ends at the last frame that ends at or before it, so
 * the walk can stop short of the boundary rather than land on it — on
 * ape-id3v1.mp3 it ends at 8150 against a trim boundary of 8208. A reverse pass
 * could never change that answer, and would run in addition to the forward walk
 * rather than instead of it.
 */
function forwardLastFrame(
  bytes: Uint8Array,
  from: number,
  end: number,
): { start: number; length: number; frames: number } {
  let o = from;
  let start = -1;
  let length = 0;
  let frames = 0;
  while (o + 6 <= end) {
    const len = frameLengthAt(bytes, o);
    if (len === 0 || o + len > end) break;
    start = o;
    length = len;
    frames++;
    o += len;
  }
  return { start, length, frames };
}

export function walkMpeg(bytes: Uint8Array): RangeWalk {
  const from = firstFrame(bytes);
  if (from < 0) return fallback("no valid first frame");
  const end = trailingTagStart(bytes);
  const last = forwardLastFrame(bytes, from, end);
  if (last.start < 0) return fallback("no valid frames");
  return {
    kind: "ranges",
    ranges: [{ offset: from, length: last.start + last.length - from }],
    detail:
      `first=${from} last=${last.start}+${last.length} frames=${last.frames}`,
  };
}

/** STREAMINFO is a FLAC file's first metadata block: the `fLaC` marker, a
 * 4-byte block header, then its 34-byte payload, whose last 16 bytes are the
 * MD5 of the *uncompressed* stream — the digest `basis: "pcm"` reports. */
export function flacStreamInfoMd5(bytes: Uint8Array): string | undefined {
  const marker = flacMarkerOffset(bytes);
  if (marker === undefined) return undefined;
  // Only trustworthy when the first block really is STREAMINFO (type 0, at
  // least its 34 bytes). Otherwise these offsets land inside another block's
  // bytes and the "digest" is 32 hex characters of somebody else's data.
  const header = marker + 4;
  if (header + 4 > bytes.length) return undefined;
  if ((bytes[header] & 0x7f) !== 0) return undefined;
  const blockLength = (bytes[header + 1] << 16) | (bytes[header + 2] << 8) |
    bytes[header + 3];
  if (blockLength < 34) return undefined;
  const payload = header + 4;
  if (payload + 34 > bytes.length) return undefined;
  let hex = "";
  for (const byte of bytes.subarray(payload + 18, payload + 34)) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * FLAC's encoded payload: the audio frames between the end of the metadata
 * block chain and any appended ID3v1/APEv2 tag. Nothing inside a FLAC stream
 * delimits the frames — the block chain's end is the start, and the stream runs
 * to EOF — so the whole rule is the block walk plus the trailing-tag trim.
 *
 * `flacAudioStart` may legitimately answer past `bytes.length`, because a
 * block's declared length can reach beyond the bytes in hand: that is the
 * extent the chain *implies*, and hashing it would read nothing while claiming
 * a payload. The `end <= start` guard is what refuses it.
 */
export function walkFlac(
  bytes: Uint8Array,
): RangeWalk & { streamInfoMd5?: string } {
  const start = flacAudioStart(bytes);
  if (start === undefined) return fallback("no fLaC marker");
  const end = trailingTagStart(bytes);
  if (end <= start) return fallback("no audio bytes");
  const streamInfoMd5 = flacStreamInfoMd5(bytes);
  return {
    kind: "ranges",
    ranges: [{ offset: start, length: end - start }],
    detail: `audioStart=${start} end=${end}`,
    // Absent, not undefined, when STREAMINFO could not be read — the repo's
    // `exactOptionalPropertyTypes` contract (see audio-file-impl.ts).
    ...(streamInfoMd5 !== undefined ? { streamInfoMd5 } : {}),
  };
}

/** Length of the atom starting at `o`, or `undefined` when its size field is
 * malformed. `size === 0` runs to end of file (8-byte header); `size === 1`
 * means the real length is the 64-bit value after the type. */
function atomLength(
  bytes: Uint8Array,
  view: DataView,
  o: number,
): { length: number; headerSize: number } | undefined {
  const size = view.getUint32(o, false);
  if (size === 0) return { length: bytes.length - o, headerSize: 8 };
  if (size === 1) {
    if (o + 16 > bytes.length) return undefined;
    const big = view.getBigUint64(o + 8, false);
    if (big > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
    return { length: Number(big), headerSize: 16 };
  }
  return { length: size, headerSize: 8 };
}

/**
 * MP4's payload: the contents of every non-empty top-level `mdat`, in file
 * order — a fragmented file spreads its audio over several, and a rewritten one
 * may carry an empty `mdat`, which is legal and contributes nothing. The header
 * is excluded, and it is 16 bytes rather than 8 when the size took the 64-bit
 * form.
 *
 * Deliberately not `metadata-extent.ts`'s atom walk: that one looks for `moov`
 * to size the partial-load gate, so it bails on any size below 8 and has no
 * 64-bit path. The checksum's rules differ — `size === 0` runs to EOF, a 64-bit
 * size is legal, and anything the walk cannot fully account for is a fallback —
 * so the two contracts stay apart rather than share an abstraction.
 *
 * Those fallbacks are the point. A range that runs past the buffer would hash
 * zero padding while `bytesHashed` counts it as payload, and bytes no atom
 * accounts for are not something this walk may call audio.
 */
export function walkMp4(bytes: Uint8Array): RangeWalk {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ranges: ByteRange[] = [];
  let o = 0;
  while (o + 8 <= bytes.length) {
    const type = text(bytes, o + 4, 4);
    const atom = atomLength(bytes, view, o);
    if (atom === undefined) return fallback(`malformed ${type} size`);
    if (atom.length < atom.headerSize) {
      return fallback(`malformed ${type} size`);
    }
    if (o + atom.length > bytes.length) return fallback(`oversized ${type}`);
    if (type === "mdat" && atom.length > atom.headerSize) {
      ranges.push({
        offset: o + atom.headerSize,
        length: atom.length - atom.headerSize,
      });
    }
    // A size of 0 already answered "to end of file" in atomLength, so this
    // lands on bytes.length and ends the loop.
    o += atom.length;
  }
  if (o !== bytes.length) return fallback("trailing bytes after the last atom");
  if (ranges.length === 0) return fallback("no non-empty mdat");
  return { kind: "ranges", ranges, detail: `${ranges.length} mdat(s)` };
}
