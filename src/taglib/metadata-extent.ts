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
 *
 * The container walkers themselves are exported (id3v2End, mpegFrameLength,
 * flacAudioStart, flacMarkerOffset) because the media checksum walks the same
 * containers to find a file's encoded-audio payload. One walker per container:
 * a second copy of these rules could silently disagree with the one that
 * decides whether a splice is safe.
 */

/** Big-endian 32-bit read; callers must have bounds-checked `offset`. */
function be32(b: Uint8Array, offset: number): number {
  return ((b[offset] << 24) | (b[offset + 1] << 16) |
    (b[offset + 2] << 8) | b[offset + 3]) >>> 0;
}

function startsWith(bytes: Uint8Array, magic: string, at = 0): boolean {
  if (bytes.length < at + magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (bytes[at + i] !== magic.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * End of an ID3v2 tag at offset 0, or undefined when there is none.
 *
 * The size field is "syncsafe": seven bits per byte, so the high bit can never
 * produce a false frame sync. A footer, when the flags say there is one, adds
 * ten bytes that the size does not cover.
 *
 * The `ID3` magic check is part of the contract, not a convenience: the size
 * arithmetic reads a number out of any ten bytes, so a tagless buffer would
 * otherwise report 22.8 million as the end of a tag it does not have. Callers
 * that have already established the magic pay one comparison for it; callers
 * that have not (the media checksum walks) need it.
 */
export function id3v2End(bytes: Uint8Array): number | undefined {
  if (!startsWith(bytes, "ID3") || bytes.length < 10) return undefined;
  const size = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) |
    bytes[9];
  const hasFooter = (bytes[5] & 0x10) !== 0;
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
    const isLast = (bytes[offset] & 0x80) !== 0;
    const length = (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) |
      bytes[offset + 3];
    offset += 4 + length;
    // Already past the window: the answer cannot change, so stop walking rather
    // than demand bytes the caller may not have read.
    if (offset > limit) return offset;
    if (isLast) return offset;
  }
}

/**
 * Offset of FLAC's `fLaC` stream marker — at 0, or just past a prepended ID3v2
 * tag (TagLib supports exactly that, flacfile.cpp:90) — or undefined when
 * neither is there. A caller that only wants STREAMINFO can seek straight to it
 * instead of walking the metadata-block chain.
 */
export function flacMarkerOffset(bytes: Uint8Array): number | undefined {
  const at = startsWith(bytes, "ID3") ? id3v2End(bytes) : 0;
  if (at === undefined) return undefined;
  return startsWith(bytes, "fLaC", at) ? at : undefined;
}

/**
 * Offset of FLAC's first audio byte: the end of the metadata-block chain, past
 * the optional ID3v2 tag.
 *
 * The chain is walked from block headers alone, so the result can exceed
 * `bytes.length` when a block's declared length reaches past the buffer — that
 * is the extent the chain implies, and the caller decides whether it holds
 * enough of the file to believe it. A buffer too short to hold the next block
 * header has no implied extent at all and answers undefined, as does one with
 * no `fLaC` marker.
 */
export function flacAudioStart(bytes: Uint8Array): number | undefined {
  const at = flacMarkerOffset(bytes);
  if (at === undefined) return undefined;
  return flacEnd(bytes, bytes.length, at);
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
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
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
    const segmentCount = bytes[offset + 26];
    const tableStart = offset + 27;
    if (tableStart + segmentCount > bytes.length) return undefined;
    let payload = 0;
    for (let i = 0; i < segmentCount; i++) {
      const segment = bytes[tableStart + i];
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

// MPEG frame-length tables, mirroring mpegheader.cpp:250-266. Indexed
// [version: 0=MPEG-1, 1=MPEG-2/2.5][layer: 0=I, 1=II, 2=III][bitrate index].
const MPEG_BITRATES: readonly number[][][] = [
  [
    [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0], // Layer I
    [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0], // Layer II
    [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0], // Layer III
  ],
  [
    [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0], // Layer I
    [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0], // Layer II
    [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0], // Layer III
  ],
];

/** kbps tables are shared by MPEG-2 and MPEG-2.5; sample rates are not. */
const MPEG_SAMPLE_RATES: readonly number[][] = [
  [44100, 48000, 32000], // MPEG-1
  [22050, 24000, 16000], // MPEG-2
  [11025, 12000, 8000], // MPEG-2.5
];

/**
 * Length in bytes of the MPEG (Layer I/II/III) frame whose header sits at `at`,
 * or 0 when `at` is not a plausible frame header.
 *
 * Plausibility is the header alone: eleven sync bits, a non-reserved version
 * and layer, a bitrate index that is neither free (0) nor invalid (15), and a
 * sample-rate index that is not reserved (3). Nothing here looks at what
 * FOLLOWS the frame — a frame header at the very end of a file is as plausible
 * as any other, which is what lets a walk reach the last frame. Callers that
 * need confidence the bytes really are MPEG audio want isMpegFrameSync, which
 * adds the next-header consistency check.
 *
 * The arithmetic mirrors mpegheader.cpp:236-264: bitrate/sample-rate tables
 * plus the padding bit, and C++ integer division truncates.
 */
export function mpegFrameLength(bytes: Uint8Array, at: number): number {
  if (bytes.length < at + 4) return 0;
  if (bytes[at] !== 0xFF || (bytes[at + 1] & 0xE0) !== 0xE0) return 0;
  const version = (bytes[at + 1] >> 3) & 0x03;
  const layer = (bytes[at + 1] >> 1) & 0x03;
  if (version === 0x01 || layer === 0x00) return 0;
  const bitrateIndex = (bytes[at + 2] >> 4) & 0x0F;
  const sampleRateIndex = (bytes[at + 2] >> 2) & 0x03;
  if (
    bitrateIndex === 0x00 || bitrateIndex === 0x0F ||
    sampleRateIndex === 0x03
  ) {
    return 0;
  }

  const mpeg1 = version === 0b11;
  const layerIndex = layer ^ 0b11; // 11=Layer I → 0, 10=II → 1, 01=III → 2
  const bitrate = MPEG_BITRATES[mpeg1 ? 0 : 1][layerIndex][bitrateIndex];
  const sampleRateTable = mpeg1 ? 0 : version === 0b10 ? 1 : 2;
  const sampleRate = MPEG_SAMPLE_RATES[sampleRateTable][sampleRateIndex];
  const samplesPerFrame = layerIndex === 2
    ? (mpeg1 ? 1152 : 576)
    : layerIndex === 1
    ? 1152
    : 384;
  // C++ integer division truncates (mpegheader.cpp:236-264); JS `/` is float,
  // and a fractional frame length would describe a frame no header can start at.
  let frameLength = Math.floor(samplesPerFrame * bitrate * 125 / sampleRate);
  if ((bytes[at + 2] & 0x02) !== 0) frameLength += layerIndex === 0 ? 4 : 1;
  return frameLength === 0 ? 0 : frameLength;
}

/**
 * True for a syntactically valid MPEG audio frame header whose frame CHAINS
 * into a consistent next frame: mpegFrameLength finds one, and — mirroring
 * MPEG::Header's checkLength (mpegheader.cpp:330-357) — a header at offset +
 * frameLength matches on sync/version/layer/sample-rate (mask 0xfffe0c00). A
 * frame that cannot be verified this way (no next header, or an inconsistent
 * one) answers false: MPEG::File::findID3v2 keeps scanning for a tag in exactly
 * that case (mpegfile.cpp:530), and a wrong-`true` here authorises a splice
 * straight through a tag the probe did not see (taglib-rfwe).
 *
 * This is the loader's partial-load gate. The next-header requirement above is
 * why it cannot serve a walk that must reach a file's last frame — see
 * mpegFrameLength for that.
 */
function isMpegFrameSync(bytes: Uint8Array, at = 0): boolean {
  const frameLength = mpegFrameLength(bytes, at);
  if (frameLength === 0) return false;

  const next = at + frameLength;
  if (bytes.length < next + 4) return false;
  const mask = 0xfffe0c00;
  const header =
    ((((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) |
      bytes[at + 3]) >>> 0) & mask) >>> 0;
  const nextHeader = ((((bytes[next] << 24) | (bytes[next + 1] << 16) |
    (bytes[next + 2] << 8) | bytes[next + 3]) >>> 0) & mask) >>> 0;
  return header === nextHeader;
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
  // `startsWith` answers false both when the magic differs and when the buffer
  // is too short to hold it. Reporting the second as null ("nothing here") let
  // an ID3v2 tag ending within a few bytes of the window vouch for a container
  // nobody looked at — the very hole this chaining was added to close.
  //
  // Whether running out of buffer means "nothing follows" or "cannot see"
  // depends on what the buffer IS. Callers pass min(limit, fileSize), so a
  // buffer shorter than `limit` is the whole file and the tag really is the end
  // of it; a buffer at least `limit` long is a window, and anything past its
  // end lies outside what we are vouching for.
  if (at >= bytes.length) return bytes.length < limit ? null : undefined;
  if (at + 8 > bytes.length) return undefined;
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
  // Refuse to vouch for bytes not supplied, mirroring the header side's guard.
  if (tail.length < Math.min(footerSize, 32)) return false;
  for (const offsetFromEnd of [32, 32 + 128]) {
    const at = tail.length - offsetFromEnd;
    if (at < 0 || !startsWith(tail, "APETAGEX", at)) continue;
    // Bytes 12..16 of the footer: tag size in little-endian, covering the
    // footer and all items but not the optional 32-byte header.
    const size = (tail[at + 12] | (tail[at + 13] << 8) |
      (tail[at + 14] << 16) | (tail[at + 15] << 24)) >>> 0;
    // At the second position the tag is followed by a 128-byte ID3v1 block, so
    // it ends that much earlier and needs that much more of the window. Omitting
    // this left a 96-byte band where an APE tag was spliced and read as audio.
    const trailing = offsetFromEnd === 32 ? 0 : 128;
    if (size + 32 + trailing > footerSize) return false;
  }
  return true;
}
