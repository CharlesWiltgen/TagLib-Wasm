import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { metadataFitsInHeader } from "./metadata-extent.ts";

/** ID3v2 header: "ID3", version, flags, then the size as four syncsafe bytes. */
function id3v2(declaredSize: number, flags = 0): Uint8Array {
  const b = new Uint8Array(10);
  b.set(new TextEncoder().encode("ID3"), 0);
  b[3] = 3;
  b[5] = flags;
  b[6] = (declaredSize >>> 21) & 0x7F;
  b[7] = (declaredSize >>> 14) & 0x7F;
  b[8] = (declaredSize >>> 7) & 0x7F;
  b[9] = declaredSize & 0x7F;
  return b;
}

/** One FLAC METADATA_BLOCK_HEADER: last-block flag, type, 24-bit length. */
function flacBlock(length: number, isLast: boolean, type = 1): Uint8Array {
  const b = new Uint8Array(4 + length);
  b[0] = (isLast ? 0x80 : 0) | type;
  b[1] = (length >>> 16) & 0xFF;
  b[2] = (length >>> 8) & 0xFF;
  b[3] = length & 0xFF;
  return b;
}

/**
 * A COMPLETE ID3v2 tag: the header plus the bytes it declares. Distinct from
 * the bare `id3v2()` header above, which is used only to check that a probe
 * refuses to vouch for an extent the buffer does not contain.
 */
function id3v2Tag(declaredSize: number, flags = 0): Uint8Array {
  const out = new Uint8Array(10 + declaredSize + ((flags & 0x10) ? 10 : 0));
  out.set(id3v2(declaredSize, flags), 0);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** One MP4 top-level atom: 32-bit big-endian size, then the four-char type. */
function atom(type: string, payloadLength: number): Uint8Array {
  const size = 8 + payloadLength;
  const b = new Uint8Array(size);
  b[0] = (size >>> 24) & 0xFF;
  b[1] = (size >>> 16) & 0xFF;
  b[2] = (size >>> 8) & 0xFF;
  b[3] = size & 0xFF;
  b.set(new TextEncoder().encode(type), 4);
  return b;
}

const LIMIT = 1024;

describe("metadataFitsInHeader", () => {
  /** One Ogg page: "OggS", header bytes, a segment table, then its payload. */
  function oggPage(segments: number[], payload?: number[]): Uint8Array {
    const payloadLength = segments.reduce((n, s) => n + s, 0);
    const b = new Uint8Array(27 + segments.length + payloadLength);
    b.set(new TextEncoder().encode("OggS"), 0);
    b[26] = segments.length;
    b.set(Uint8Array.from(segments), 27);
    if (payload) b.set(Uint8Array.from(payload), 27 + segments.length);
    return b;
  }

  it("accepts an ID3v2 tag that ends inside the window", () => {
    // 10-byte header + 100 declared = 110 bytes, well inside LIMIT.
    assertEquals(metadataFitsInHeader(id3v2Tag(100), LIMIT), true);
  });

  it("rejects an ID3v2 tag that ends past the window", () => {
    // The reported defect: a tag larger than the header window gets spliced
    // mid-frame, so the caller must fall back to a full read.
    assertEquals(metadataFitsInHeader(id3v2Tag(LIMIT), LIMIT), false);
  });

  it("counts the ID3v2 footer against the window", () => {
    // Footer flag (0x10) adds 10 bytes beyond the declared size, which is
    // exactly enough to push this tag over.
    const exact = LIMIT - 10;
    assertEquals(metadataFitsInHeader(id3v2Tag(exact), LIMIT), true);
    assertEquals(metadataFitsInHeader(id3v2Tag(exact, 0x10), LIMIT), false);
  });

  it("walks FLAC metadata blocks to the last one", () => {
    const flac = concat(
      new TextEncoder().encode("fLaC"),
      flacBlock(34, false, 0),
      flacBlock(100, true, 6),
    );
    assertEquals(metadataFitsInHeader(flac, LIMIT), true);
  });

  it("rejects a FLAC picture block that overruns the window", () => {
    // The real-world FLAC failure: one oversized METADATA_BLOCK_PICTURE.
    const flac = concat(
      new TextEncoder().encode("fLaC"),
      flacBlock(34, false, 0),
      flacBlock(LIMIT * 4, true, 6),
    );
    assertEquals(metadataFitsInHeader(flac, LIMIT), false);
  });

  it("accepts MP4 when moov precedes the media data", () => {
    // "faststart" layout: ftyp, moov, then mdat.
    const mp4 = concat(atom("ftyp", 16), atom("moov", 200), atom("mdat", 64));
    assertEquals(metadataFitsInHeader(mp4, LIMIT), true);
  });

  it("rejects MP4 when moov sits past the window behind the media data", () => {
    // Non-faststart: moov is at the end, so a header+footer splice moves it to
    // an offset TagLib will not find it at.
    const mp4 = concat(atom("ftyp", 16), atom("mdat", LIMIT * 4));
    assertEquals(metadataFitsInHeader(mp4, LIMIT), false);
  });

  it("accepts Ogg once the comment header packet completes", () => {
    // Packet 1 is the identification header, packet 2 the comment header; a
    // segment shorter than 255 terminates a packet. Both land in the window
    // here, which is the ordinary case a partial read exists for.
    const ogg = concat(oggPage([30]), oggPage([100]));
    assertEquals(metadataFitsInHeader(ogg, LIMIT), true);
  });

  it("rejects Ogg whose comment header runs past the window", () => {
    // 255 continues the packet into the next page, so this one never completes
    // inside the window.
    const ogg = concat(oggPage([30]), oggPage([255, 255]), oggPage([255, 255]));
    assertEquals(metadataFitsInHeader(ogg, 200), false);
  });

  it("accepts an MP3 carrying no ID3v2 tag at all", () => {
    // Metadata lives only in the trailer (ID3v1/APE), which the FOOTER window
    // covers — so there is nothing in the header window to truncate. These are
    // precisely the files the footer half was added for, and rejecting them
    // gave up the optimisation on exactly the wrong set.
    const mp3 = new Uint8Array(64);
    mp3[0] = 0xFF;
    mp3[1] = 0xFB; // MPEG-1 Layer III
    mp3[2] = 0x90; // 128 kbps, 44100 Hz — TagLib rejects a free/invalid index
    assertEquals(metadataFitsInHeader(mp3, LIMIT), true);
  });

  it("rejects a bare frame sync that is not an MPEG header", () => {
    // 0xFF followed by an invalid version/layer is not a frame sync, and must
    // not be mistaken for a tagless MP3.
    const notMp3 = new Uint8Array(64);
    notMp3[0] = 0xFF;
    notMp3[1] = 0x00;
    assertEquals(metadataFitsInHeader(notMp3, LIMIT), false);
  });

  it("walks past an ID3v2 prefix into the container behind it", () => {
    // TagLib supports an ID3v2 tag PRECEDING FLAC's own chain
    // (flacfile.cpp:90). Judging by the ID3v2 extent alone authorised a splice
    // through a 2 MB picture block — a 37-byte prefix flipped the verdict.
    const prefix = id3v2Tag(27);
    const oversized = concat(
      new TextEncoder().encode("fLaC"),
      flacBlock(34, false, 0),
      flacBlock(LIMIT * 4, true, 6),
    );
    const modest = concat(
      new TextEncoder().encode("fLaC"),
      flacBlock(34, false, 0),
      flacBlock(100, true, 6),
    );
    assertEquals(metadataFitsInHeader(concat(prefix, oversized), LIMIT), false);
    assertEquals(metadataFitsInHeader(concat(prefix, modest), LIMIT), true);
  });

  it("declines FLAC-in-Ogg, whose comment need not be the second packet", () => {
    // Ogg::FLAC::File::scan() takes the comment from wherever block type 4
    // appears; only libFLAC's convention puts it second, and nothing enforces it.
    const flacInOgg = concat(
      oggPage([5], [0x7F, ...new TextEncoder().encode("FLAC")]),
      oggPage([30]),
    );
    assertEquals(metadataFitsInHeader(flacInOgg, LIMIT), false);
  });

  it("rejects a frame sync TagLib itself would reject", () => {
    // MPEG::Header also requires a usable bitrate and sample-rate index, and
    // MPEG::File::findID3v2 keeps scanning for a tag when byte 0 is not a valid
    // frame — so a lax test here concludes "no ID3v2" for a file that has one.
    const bogus = Uint8Array.from([0xFF, 0xFB, 0xFF, 0xFF, 0, 0, 0, 0]);
    assertEquals(metadataFitsInHeader(bogus, LIMIT), false);
    const valid = Uint8Array.from([0xFF, 0xFB, 0x90, 0x00, 0, 0, 0, 0]);
    assertEquals(metadataFitsInHeader(valid, LIMIT), true);
  });

  it("refuses to vouch for an extent outside the buffer it was given", () => {
    // The probes read structural fields only, so they can report an extent they
    // never saw. Both call sites currently pass a full-length buffer, but a
    // short-read optimisation would otherwise reopen this whole defect class.
    assertEquals(metadataFitsInHeader(id3v2(100_000), 1_000_000), false);
  });

  it("rejects a format whose metadata extent it cannot determine", () => {
    // Unknown container: partial loading is unsafe because nothing here proves
    // the metadata is intact, so the safe answer is a full read.
    assertEquals(metadataFitsInHeader(new Uint8Array(64), LIMIT), false);
  });

  it("rejects malformed input rather than looping or overrunning", () => {
    // A zero/short atom size must not spin forever, and a truncated ID3v2
    // header must not be read past its end.
    assertEquals(
      metadataFitsInHeader(atom("ftyp", 0).slice(0, 8), LIMIT),
      false,
    );
    assertEquals(metadataFitsInHeader(id3v2(100).slice(0, 6), LIMIT), false);
    const zeroSized = new Uint8Array(16);
    zeroSized.set(new TextEncoder().encode("ftyp"), 4);
    assertEquals(metadataFitsInHeader(zeroSized, LIMIT), false);
  });
});
