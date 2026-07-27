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
function flacEnd(bytes: Uint8Array, limit: number): number | undefined {
  let offset = 4; // past "fLaC"
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
function mp4MoovEnd(bytes: Uint8Array, limit: number): number | undefined {
  let offset = 0;
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
function oggMetadataEnd(bytes: Uint8Array, limit: number): number | undefined {
  let offset = 0;
  let packetsCompleted = 0;
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
    offset = tableStart + segmentCount + payload;
    // Through the comment header: everything TagLib reads as metadata is behind
    // us. Also stop once past the window, where the answer can no longer change.
    if (packetsCompleted >= 2 || offset > limit) return offset;
  }
}

/**
 * True for an MPEG audio frame sync: eleven set bits, then a version and layer
 * that are not the reserved encodings. Used to recognise an MP3 that carries no
 * ID3v2 tag, whose metadata therefore lives entirely in the trailer.
 */
function isMpegFrameSync(bytes: Uint8Array): boolean {
  if (bytes.length < 2) return false;
  if (bytes[0] !== 0xFF || (bytes[1]! & 0xE0) !== 0xE0) return false;
  const version = (bytes[1]! >> 3) & 0x03;
  const layer = (bytes[1]! >> 1) & 0x03;
  return version !== 0x01 && layer !== 0x00;
}

/**
 * True only when the metadata of `header` provably ends within `limit` bytes.
 *
 * `header` is the start of the file and may be shorter than `limit`; anything
 * this cannot prove — an unknown container, a truncated header, a malformed
 * size — answers false so the caller reads the whole file.
 */
export function metadataFitsInHeader(
  header: Uint8Array,
  limit: number,
): boolean {
  let end: number | undefined;
  if (startsWith(header, "ID3")) {
    end = id3v2End(header);
  } else if (startsWith(header, "fLaC")) {
    end = flacEnd(header, limit);
  } else if (startsWith(header, "ftyp", 4)) {
    end = mp4MoovEnd(header, limit);
  } else if (startsWith(header, "OggS")) {
    end = oggMetadataEnd(header, limit);
  } else if (isMpegFrameSync(header)) {
    // No ID3v2 tag, so nothing in the header window can be truncated. Any
    // metadata is an ID3v1/APE trailer, which the footer window covers.
    end = 0;
  }
  return end !== undefined && end <= limit;
}
