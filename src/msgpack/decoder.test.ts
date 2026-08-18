import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { encode } from "@msgpack/msgpack";
import { decodeTagData } from "./decoder.ts";

describe("decodeTagData key normalization", () => {
  it("should decode ACOUSTID_FINGERPRINT to acoustidFingerprint", () => {
    const msgpack = encode({ ACOUSTID_FINGERPRINT: "AQADtNQYhYkYRcg" });
    const decoded = decodeTagData(new Uint8Array(msgpack)) as Record<
      string,
      unknown
    >;
    assertEquals(decoded.acoustidFingerprint, "AQADtNQYhYkYRcg");
    assertEquals(
      "ACOUSTID_FINGERPRINT" in decoded,
      false,
    );
  });

  it("should decode disc to discNumber", () => {
    const msgpack = encode({ disc: 2 });
    const decoded = decodeTagData(new Uint8Array(msgpack)) as Record<
      string,
      unknown
    >;
    assertEquals(decoded.discNumber, 2);
    assertEquals("disc" in decoded, false);
  });

  it("should decode DISCNUMBER to discNumber", () => {
    const msgpack = encode({ DISCNUMBER: 3 });
    const decoded = decodeTagData(new Uint8Array(msgpack)) as Record<
      string,
      unknown
    >;
    assertEquals(decoded.discNumber, 3);
  });

  it("should decode basic UPPERCASE keys to camelCase", () => {
    const msgpack = encode({
      TITLE: "Test",
      ARTIST: "Artist",
      ALBUM: "Album",
      DATE: 2025,
      TRACKNUMBER: 3,
    });
    const decoded = decodeTagData(new Uint8Array(msgpack)) as Record<
      string,
      unknown
    >;
    assertEquals(decoded.title, "Test");
    assertEquals(decoded.artist, "Artist");
    assertEquals(decoded.album, "Album");
    assertEquals(decoded.date, 2025);
    assertEquals(decoded.trackNumber, 3);
  });

  it("should decode MusicBrainz fields to camelCase", () => {
    const msgpack = encode({
      MUSICBRAINZ_TRACKID: "abc-123",
      MUSICBRAINZ_ALBUMID: "def-456",
    });
    const decoded = decodeTagData(new Uint8Array(msgpack)) as Record<
      string,
      unknown
    >;
    assertEquals(decoded.musicbrainzTrackId, "abc-123");
    assertEquals(decoded.musicbrainzReleaseId, "def-456");
  });

  it("should decode ReplayGain fields to camelCase", () => {
    const msgpack = encode({
      REPLAYGAIN_TRACK_GAIN: "-6.54 dB",
      REPLAYGAIN_TRACK_PEAK: "0.98765",
    });
    const decoded = decodeTagData(new Uint8Array(msgpack)) as Record<
      string,
      unknown
    >;
    assertEquals(decoded.replayGainTrackGain, "-6.54 dB");
    assertEquals(decoded.replayGainTrackPeak, "0.98765");
  });

  it("should leave already-camelCase keys as-is", () => {
    const msgpack = encode({
      title: "Test",
      artist: "Artist",
      albumArtist: "VA",
    });
    const decoded = decodeTagData(new Uint8Array(msgpack)) as Record<
      string,
      unknown
    >;
    assertEquals(decoded.title, "Test");
    assertEquals(decoded.artist, "Artist");
    assertEquals(decoded.albumArtist, "VA");
  });

  it("should pass through unknown keys as-is", () => {
    const msgpack = encode({ CUSTOM_UNKNOWN: "value" });
    const decoded = decodeTagData(new Uint8Array(msgpack)) as Record<
      string,
      unknown
    >;
    assertEquals(decoded["CUSTOM_UNKNOWN"], "value");
  });
});

describe("decodeTagData boolean property normalization", () => {
  it("decodes a bare mpack bool as '1'/'0' (FIELD_BOOLEAN round-trip)", () => {
    const msgpack = encode({ compilation: true });
    const decoded = decodeTagData(new Uint8Array(msgpack)) as Record<
      string,
      unknown
    >;
    assertEquals(decoded.compilation, "1");
    const decodedFalse = decodeTagData(
      new Uint8Array(encode({ compilation: false })),
    ) as Record<string, unknown>;
    assertEquals(decodedFalse.compilation, "0");
  });

  it("decodes booleans inside value arrays as '1'/'0'", () => {
    const msgpack = encode({ compilation: [true, false] });
    const decoded = decodeTagData(new Uint8Array(msgpack)) as Record<
      string,
      unknown
    >;
    assertEquals(decoded.compilation, ["1", "0"]);
  });

  it("leaves bare booleans in nested maps (id3Tags) untouched", () => {
    const msgpack = encode({ id3Tags: { v1: true, v2: false } });
    const decoded = decodeTagData(new Uint8Array(msgpack)) as Record<
      string,
      unknown
    >;
    assertEquals(decoded.id3Tags, { v1: true, v2: false });
  });

  it("leaves audio-info booleans (isLossless, isEncrypted) untouched", () => {
    const msgpack = encode({ isLossless: true, isEncrypted: false });
    const decoded = decodeTagData(new Uint8Array(msgpack)) as Record<
      string,
      unknown
    >;
    assertEquals(decoded.isLossless, true);
    assertEquals(decoded.isEncrypted, false);
  });

  it("leaves string and number values untouched", () => {
    const msgpack = encode({ title: "Song", track: 3 });
    const decoded = decodeTagData(new Uint8Array(msgpack)) as Record<
      string,
      unknown
    >;
    assertEquals(decoded.title, "Song");
    assertEquals(decoded.track, 3);
  });
});
