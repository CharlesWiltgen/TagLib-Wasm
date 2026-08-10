import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  metadataFitsInHeader,
  trailerFitsInFooter,
} from "./metadata-extent.ts";

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
    // exactly enough to push this tag over. Sized so the no-footer case ends
    // just INSIDE the window rather than exactly filling it: a tag that fills
    // the window leaves no room to check what follows it, and is correctly
    // rejected on those grounds instead — which is a different rule.
    const almost = LIMIT - 15;
    assertEquals(metadataFitsInHeader(id3v2Tag(almost), LIMIT), true);
    assertEquals(metadataFitsInHeader(id3v2Tag(almost, 0x10), LIMIT), false);
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
    // A real tagless MP3 has a FRAME CHAIN, not a lone header: frameLength for
    // this header (128 kbps / 44100 Hz) is 417, so the second frame starts at
    // byte 417 (taglib-rfwe requires the next frame to be consistent).
    const mp3 = new Uint8Array(417 + 4);
    mp3[0] = 0xFF;
    mp3[1] = 0xFB; // MPEG-1 Layer III
    mp3[2] = 0x90; // 128 kbps, 44100 Hz — TagLib rejects a free/invalid index
    mp3[417] = 0xFF;
    mp3[418] = 0xFB;
    mp3[419] = 0x90;
    assertEquals(metadataFitsInHeader(mp3, LIMIT), true);
  });

  it("rejects a bare frame sync that is not an MPEG header", () => {
    // Sync bits PRESENT and bitrate/sample-rate valid, so only the version and
    // layer test can reject this. The previous fixture (0xFF 0x00 0x00) was
    // caught independently by three guards, so it exercised the sync-bit check
    // rather than the one it names.
    const notMp3 = new Uint8Array(64);
    notMp3[0] = 0xFF;
    notMp3[1] = 0xF8; // sync bits set, version 3, layer index 0 = reserved
    notMp3[2] = 0x90; // valid bitrate and sample-rate indices
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
    // "Valid" means a chained pair of frames: the first header alone cannot
    // vouch for "no metadata" any more (taglib-rfwe).
    const valid = new Uint8Array(417 + 4);
    valid.set([0xFF, 0xFB, 0x90, 0x00], 0);
    valid.set([0xFF, 0xFB, 0x90, 0x00], 417);
    assertEquals(metadataFitsInHeader(valid, LIMIT), true);
  });

  it("rejects a lone MPEG frame whose next frame is inconsistent (taglib-rfwe)", () => {
    // MPEG::Header additionally requires the frame at offset + frameLength to
    // be consistent (checkLength, mpegheader.cpp:330-357); MPEG::File::findID3v2
    // keeps scanning for an ID3v2 tag when it is not. A probe that answers
    // "no metadata in the header window" here authorises a splice straight
    // through the tag it did not see — measured losing every value of a 1.2 MB
    // ID3v2 tag behind 4 valid-looking frame bytes.
    // Frame: FF FB 90 64 — MPEG-1 Layer III, bitrate index 9 (128 kbps),
    // sample-rate index 0 (44100 Hz) → frameLength 417; byte 417 lands inside
    // the ID3v2 tag, whose header fails the mask comparison.
    const frame = Uint8Array.from([0xFF, 0xFB, 0x90, 0x64]);
    const id3 = new Uint8Array(LIMIT * 2);
    id3.set(new TextEncoder().encode("ID3\x04\x00\x00"), 0);
    const tagged = concat(frame, id3);
    assertEquals(metadataFitsInHeader(tagged, LIMIT), false);

    // The same frame followed by a CONSISTENT frame is a real tagless MP3 —
    // the next-frame check must not reject the population the footer window
    // exists for.
    const chain = new Uint8Array(417 + 4);
    chain.set(frame, 0);
    chain.set(Uint8Array.from([0xFF, 0xFB, 0x90, 0x64]), 417);
    assertEquals(metadataFitsInHeader(chain, LIMIT), true);

    // A frame whose chain is cut off by the end of the buffer cannot vouch for
    // "no metadata" either (TagLib: nextData.size() < 4 → invalid).
    assertEquals(metadataFitsInHeader(frame, LIMIT), false);
  });

  it("refuses to vouch for an extent outside the buffer it was given", () => {
    // The probes read structural fields only, so they can report an extent they
    // never saw. Both call sites currently pass a full-length buffer, but a
    // short-read optimisation would otherwise reopen this whole defect class.
    assertEquals(metadataFitsInHeader(id3v2(100_000), 1_000_000), false);
  });

  it("does not vouch for a container it lacks the bytes to look at", () => {
    // A WINDOW-length buffer whose ID3v2 tag ends a few bytes short of the
    // limit: the container behind it cannot be inspected, so the tag's own
    // extent must not stand in for it. A tag ending exactly AT the limit is the
    // same case. (A buffer shorter than the limit is a whole small file, where
    // the tag really is the end — covered by the tests above.)
    // The buffer is EXACTLY the window, so the bytes after the tag are the ones
    // partial loading would splice away. At these gaps the container magic
    // cannot be read, which previously answered "nothing there" and let the
    // tag's own extent stand in for a FLAC chain nobody looked at.
    for (const gap of [0, 1, 2, 3]) {
      const window = new Uint8Array(LIMIT);
      window.set(id3v2Tag(LIMIT - gap - 10), 0);
      assertEquals(
        metadataFitsInHeader(window, LIMIT),
        false,
        `a tag ending ${gap} bytes before the limit vouched for what follows`,
      );
    }
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

describe("trailerFitsInFooter", () => {
  /** A file tail whose last bytes are an APE footer declaring `size`. */
  function apeTail(size: number, followedById3v1: boolean): Uint8Array {
    const tail = new Uint8Array(4096);
    const at = tail.length - 32 - (followedById3v1 ? 128 : 0);
    tail.set(new TextEncoder().encode("APETAGEX"), at);
    tail[at + 12] = size & 0xFF;
    tail[at + 13] = (size >>> 8) & 0xFF;
    tail[at + 14] = (size >>> 16) & 0xFF;
    tail[at + 15] = (size >>> 24) & 0xFF;
    if (followedById3v1) {
      tail.set(new TextEncoder().encode("TAG"), tail.length - 128);
    }
    return tail;
  }

  const FOOTER = 131072;

  it("accepts an APE tag that fits the footer window", () => {
    assertEquals(trailerFitsInFooter(apeTail(41_000, false), FOOTER), true);
  });

  it("rejects an APE tag larger than the footer window", () => {
    // Measured: a 410 KB APE tag lost EVERY tag value, because the splice
    // makes TagLib compute the tag start inside the header window's audio.
    assertEquals(trailerFitsInFooter(apeTail(410_000, false), FOOTER), false);
  });

  it("counts the ID3v1 block sitting after an APE tag", () => {
    // When ID3v1 follows, the APE body ends 128 bytes earlier and needs that
    // much more of the window. Omitting it left a 96-byte band in which a tag
    // was spliced and then parsed out of audio.
    const size = FOOTER - 100; // fits under +32, does NOT fit under +128
    assertEquals(trailerFitsInFooter(apeTail(size, false), FOOTER), true);
    assertEquals(trailerFitsInFooter(apeTail(size, true), FOOTER), false);
  });

  it("accepts a tail with no APE trailer at all", () => {
    assertEquals(trailerFitsInFooter(new Uint8Array(4096), FOOTER), true);
  });

  it("refuses to vouch for a tail shorter than the footer it is asked about", () => {
    assertEquals(trailerFitsInFooter(new Uint8Array(8), FOOTER), false);
  });
});
