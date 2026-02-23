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
    assertEquals(decoded.year, 2025);
    assertEquals(decoded.track, 3);
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
