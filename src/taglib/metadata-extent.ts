/**
 * @fileoverview Is a file's metadata provably contained in its first N bytes?
 *
 * Partial loading (`TagLib.open(path, { partial: true })`) hands TagLib the
 * file's first `maxHeaderSize` bytes concatenated with its last `maxFooterSize`
 * bytes, discarding the middle. That is only sound when the metadata lives
 * entirely inside the header window: otherwise the tag is cut mid-structure and
 * unrelated footer bytes are spliced onto the cut, so TagLib parses whatever
 * lands there. Measured on a real library, 18 of 40 large MP3s read back
 * DIFFERENT metadata that way, and before taglib-f5hp the malformed image also
 * tripped a double free that trapped the whole Wasm module (taglib-f5hp).
 *
 * So the decision is made before splicing, and the rule is deliberately
 * asymmetric: return true ONLY when the metadata is provably contained. Anything
 * unrecognised, malformed, or unbounded answers false, which costs a full read
 * and never costs correctness.
 */

/** Big-endian 32-bit read; callers must have bounds-checked `offset`. */
function be32(b: Uint8Array, offset: number): number {
  return ((b[offset]! << 24) | (b[offset + 1]! << 16) |
    (b[offset + 2]! << 8) | b[offset + 3]!) >>> 0;
}

function startsWith(bytes: Uint8Array, magic: string, at = 0): boolean {
  if (bytes.length < at + magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (bytes[at + i] !== magic.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * End of an ID3v2 tag at offset 0. The size field is "syncsafe": seven bits per
 * byte, so the high bit can never produce a false frame sync. A footer, when the
 * flags say there is one, adds ten bytes that the size does not cover.
 */
function id3v2End(bytes: Uint8Array): number | undefined {
  if (bytes.length < 10) return undefined;
  const size = (bytes[6]! << 21) | (bytes[7]! << 14) | (bytes[8]! << 7) |
    bytes[9]!;
  const hasFooter = (bytes[5]! & 0x10) !== 0;
  return 10 + size + (hasFooter ? 10 : 0);
}

/**
 * End of FLAC's metadata block chain. Each block is a four-byte header (last-
 * block flag, type, 24-bit length) followed by its payload, so the chain can be
 * walked without reading any payload — which is what lets an oversized PICTURE
 * block be detected from a short prefix.
 */
function flacEnd(
  bytes: Uint8Array,
  limit: number,
  start: number,
): number | undefined {
  let offset = start + 4; // past "fLaC"
  for (;;) {
    if (offset + 4 > bytes.length) return undefined;
    const isLast = (bytes[offset]! & 0x80) !== 0;
    const length = (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!;
    offset += 4 + length;
    // Already past the window: the answer cannot change, so stop walking rather
    // than demand bytes the caller may not have read.
    if (offset > limit) return offset;
    if (isLast) return offset;
  }
}

/**
 * End of MP4's `moov` atom, which holds every tag. Top-level atoms are a flat
 * list of [32-bit size][4-char type]. A "faststart" file puts moov before the
 * media data and is cheap to verify; when moov sits behind a multi-megabyte
 * mdat it cannot be reached from the header window at all, and splicing would
 * move it to an offset TagLib will not look at — so that answers undefined.
 */
function mp4MoovEnd(
  bytes: Uint8Array,
  limit: number,
  start: number,
): number | undefined {
  let offset = start;
  const readable = Math.min(bytes.length, limit);
  while (offset + 8 <= readable) {
    const size = be32(bytes, offset);
    const type = String.fromCharCode(
      bytes[offset + 4]!,
      bytes[offset + 5]!,
      bytes[offset + 6]!,
      bytes[offset + 7]!,
    );
    // size 0 runs to end of file and size < 8 is malformed; either way the walk
    // cannot advance, and a loop that cannot advance must not spin.
    if (size < 8) return undefined;
    if (type === "moov") return offset + size;
    offset += size;
  }
  return undefined;
}

/**
 * End of the Ogg page in which the comment header packet completes. Ogg carries
 * metadata in the second packet of the stream (the first being the codec
 * identification header), and a page's segment table ends a packet at the first
 * segment shorter than 255 — so the walk needs only page headers, never payload.
 */
function oggMetadataEnd(
  bytes: Uint8Array,
  limit: number,
  start: number,
): number | undefined {
  let offset = start;
  let packetsCompleted = 0;
  let first = true;
  for (;;) {
    if (offset + 27 > bytes.length || !startsWith(bytes, "OggS", offset)) {
      return undefined;
    }
    const segmentCount = bytes[offset + 26]!;
    const tableStart = offset + 27;
    if (tableStart + segmentCount > bytes.length) return undefined;
    let payload = 0;
    for (let i = 0; i < segmentCount; i++) {
      const segment = bytes[tableStart + i]!;
      payload += segment;
      if (segment < 255) packetsCompleted++;
    }
    // "packet 2 is the comment header" holds for Vorbis, Opus and Speex by
    // spec, but NOT for FLAC-in-Ogg: Ogg::FLAC::File::scan() takes the comment
    // from wherever block type 4 appears in the chain, which libFLAC happens to
    // put second and nothing requires to be. Decline rather than guess.
    if (first) {
      const payloadStart = tableStart + segmentCount;
      if (payloadStart + 5 > bytes.length) return undefined;
      if (
        bytes[payloadStart] === 0x7F &&
        startsWith(bytes, "FLAC", payloadStart + 1)
      ) {
        return undefined;
      }
      first = false;
    }
    offset = tableStart + segmentCount + payload;
    // Through the comment header: everything TagLib reads as metadata is behind
    // us. Also stop once past the window, where the answer can no longer change.
    if (packetsCompleted >= 2 || offset > limit) return offset;
  }
}

/**
 * True for an MPEG audio frame header, using the SAME validity test as
 * MPEG::Header (mpegheader.cpp:271-295): eleven sync bits, a non-reserved
 * version and layer, and — crucially — a bitrate index that is neither free (0)
 * nor invalid (15) and a sample-rate index that is not reserved (3).
 *
 * Matching TagLib exactly is the point, not thoroughness for its own sake.
 * MPEG::File::findID3v2 uses this test to decide whether to STOP looking for an
 * ID3v2 tag; if byte 0 is not a valid frame it keeps scanning forward. A laxer
 * test here would conclude "no ID3v2 tag" for a file that has one further in,
 * and authorise a splice straight through it.
 */
function isMpegFrameSync(bytes: Uint8Array, at = 0): boolean {
  if (bytes.length < at + 4) return false;
  if (bytes[at] !== 0xFF || (bytes[at + 1]! & 0xE0) !== 0xE0) return false;
  const version = (bytes[at + 1]! >> 3) & 0x03;
  const layer = (bytes[at + 1]! >> 1) & 0x03;
  if (version === 0x01 || layer === 0x00) return false;
  const bitrateIndex = (bytes[at + 2]! >> 4) & 0x0F;
  const sampleRateIndex = (bytes[at + 2]! >> 2) & 0x03;
  return bitrateIndex !== 0x00 && bitrateIndex !== 0x0F &&
    sampleRateIndex !== 0x03;
}

/**
 * End of whatever container begins at `at`, or null when nothing recognisable
 * is there. Separated from the dispatch so an ID3v2 tag can be walked PAST and
 * the container behind it probed in turn.
 */
function containerEnd(
  bytes: Uint8Array,
  at: number,
  limit: number,
): number | undefined | null {
  if (startsWith(bytes, "fLaC", at)) return flacEnd(bytes, limit, at);
  if (startsWith(bytes, "ftyp", at + 4)) return mp4MoovEnd(bytes, limit, at);
  if (startsWith(bytes, "OggS", at)) return oggMetadataEnd(bytes, limit, at);
  return null;
}

/**
 * True only when the metadata of `header` provably ends within `limit` bytes.
 *
 * `header` is the start of the file and may be shorter than `limit`; anything
 * this cannot prove — an unknown container, a truncated header, a malformed
 * size — answers false so the caller reads the whole file.
 *
 * NOTE this judges the HEADER window only. Trailer metadata (ID3v1, APE) is the
 * caller's business — see trailerFitsInFooter.
 */
export function metadataFitsInHeader(
  header: Uint8Array,
  limit: number,
): boolean {
  let end: number | undefined;

  if (startsWith(header, "ID3")) {
    const tagEnd = id3v2End(header);
    if (tagEnd === undefined) return false;
    end = tagEnd;
    // An ID3v2 tag may PRECEDE another container's own metadata — TagLib
    // supports exactly that for FLAC (flacfile.cpp:90). Judging by the ID3v2
    // extent alone would authorise a splice straight through the Xiph comment,
    // and a 37-byte prefix was measured flipping the verdict on a 2 MB FLAC.
    if (tagEnd <= limit) {
      const behind = containerEnd(header, tagEnd, limit);
      if (behind === undefined) return false;
      if (behind !== null) end = behind;
    }
  } else {
    const container = containerEnd(header, 0, limit);
    if (container === null) {
      // No ID3v2 and no container: an MPEG frame here means the header window
      // holds no metadata at all, so nothing in it can be truncated.
      end = isMpegFrameSync(header) ? 0 : undefined;
    } else {
      end = container;
    }
  }

  // Every probe reports an extent it did not necessarily SEE — it reads only
  // structural fields. Refusing to vouch for bytes outside the buffer keeps the
  // "provable" contract honest, and stops a future short-read optimisation from
  // silently reopening this whole defect class.
  if (end === undefined || end > header.length) return false;
  return end <= limit;
}

/**
 * True when a file's TRAILER metadata provably fits in the last `footerSize`
 * bytes, given `tail` — the end of the file, at least that long.
 *
 * Partial loading keeps the file's last `footerSize` bytes, so ID3v1 (always
 * exactly 128 bytes) is safe by construction. APEv2 is not: it is unbounded
 * because it can carry cover art, and an APE tag larger than the footer window
 * is spliced so that TagLib computes its start inside the header window's audio
 * and reads nothing. Measured: a 410 KB APE tag lost EVERY tag value silently,
 * while a 41 KB one round-tripped.
 */
export function trailerFitsInFooter(
  tail: Uint8Array,
  footerSize: number,
): boolean {
  // The APE footer is the last 32 bytes of the tag, which sits either at the
  // very end or just before an ID3v1 block.
  for (const offsetFromEnd of [32, 32 + 128]) {
    const at = tail.length - offsetFromEnd;
    if (at < 0 || !startsWith(tail, "APETAGEX", at)) continue;
    // Bytes 12..16 of the footer: tag size in little-endian, covering the
    // footer and all items but not the optional 32-byte header.
    const size = (tail[at + 12]! | (tail[at + 13]! << 8) |
      (tail[at + 14]! << 16) | (tail[at + 15]! << 24)) >>> 0;
    if (size + 32 > footerSize) return false;
  }
  return true;
}
