import { id3v2End, mpegFrameLength } from "./metadata-extent.ts";

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
  let at = end;
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

/** Forward walk: the correct answer, O(frames). */
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

/**
 * Backward scan: fast path. A candidate must be plausible AND end exactly at the
 * payload end — accepting merely "fits inside" finds false syncs within the last
 * frame's payload (measured on kiss-snippet.mp3: an offer at 84558+72 inside the
 * real frame ending at 85226).
 */
function backwardLastFrame(
  bytes: Uint8Array,
  from: number,
  end: number,
): { start: number; length: number } {
  for (let o = end - 6; o >= from; o--) {
    const len = frameLengthAt(bytes, o);
    if (len > 0 && o + len === end) return { start: o, length: len };
  }
  return { start: -1, length: 0 };
}

export function walkMpeg(bytes: Uint8Array): RangeWalk {
  const from = firstFrame(bytes);
  if (from < 0) return fallback("no valid first frame");
  const end = trailingTagStart(bytes);
  const fwd = forwardLastFrame(bytes, from, end);
  if (fwd.start < 0) return fallback("no valid frames");
  const bwd = backwardLastFrame(bytes, from, end);
  const fast = fwd.start === bwd.start && fwd.length === bwd.length;
  return {
    kind: "ranges",
    ranges: [{ offset: from, length: fwd.start + fwd.length - from }],
    detail:
      `first=${from} last=${fwd.start}+${fwd.length} frames=${fwd.frames} ${
        fast ? "fast" : "forward"
      }`,
  };
}
