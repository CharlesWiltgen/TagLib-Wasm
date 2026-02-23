import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { decode } from "@msgpack/msgpack";
import { encodeTagData } from "./encoder.ts";
import type { ExtendedTag } from "../types.ts";

describe("encodeTagData key transformation", () => {
  it("should encode acoustidFingerprint as ACOUSTID_FINGERPRINT", () => {
    const tag = { acoustidFingerprint: "AQADtNQYhYkYRcg" } as Record<
      string,
      unknown
    >;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    assertEquals(encoded["ACOUSTID_FINGERPRINT"], "AQADtNQYhYkYRcg");
    assertEquals("acoustidFingerprint" in encoded, false);
  });

  it("should encode discNumber as DISCNUMBER", () => {
    const tag = { discNumber: 2 } as Record<string, unknown>;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    assertEquals(encoded["DISCNUMBER"], 2);
    assertEquals("discNumber" in encoded, false);
  });

  it("should encode basic fields to UPPERCASE", () => {
    const tag = {
      title: "Test",
      artist: "Artist",
      album: "Album",
      year: 2025,
      track: 3,
    } as Record<string, unknown>;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    assertEquals(encoded["TITLE"], "Test");
    assertEquals(encoded["ARTIST"], "Artist");
    assertEquals(encoded["ALBUM"], "Album");
    assertEquals(encoded["DATE"], 2025);
    assertEquals(encoded["TRACKNUMBER"], 3);
  });

  it("should preserve pictures and ratings keys as-is", () => {
    const tag = {
      title: "Test",
      pictures: [{
        mimeType: "image/jpeg",
        data: new Uint8Array([1, 2, 3]),
        type: 3,
      }],
      ratings: [{ rating: 0.8, email: "", counter: 0 }],
    } as Record<string, unknown>;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    assertEquals("pictures" in encoded, true);
    assertEquals("ratings" in encoded, true);
  });

  it("should encode MusicBrainz fields to UPPERCASE", () => {
    const tag = {
      musicbrainzTrackId: "abc-123",
      musicbrainzReleaseId: "def-456",
    } as Record<string, unknown>;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    assertEquals(encoded["MUSICBRAINZ_TRACKID"], "abc-123");
    assertEquals(encoded["MUSICBRAINZ_ALBUMID"], "def-456");
  });

  it("should encode ReplayGain fields to UPPERCASE", () => {
    const tag = {
      replayGainTrackGain: "-6.54 dB",
      replayGainTrackPeak: "0.98765",
    } as Record<string, unknown>;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    assertEquals(encoded["REPLAYGAIN_TRACK_GAIN"], "-6.54 dB");
    assertEquals(encoded["REPLAYGAIN_TRACK_PEAK"], "0.98765");
  });

  it("should encode sort fields to UPPERCASE", () => {
    const tag = {
      titleSort: "Title, The",
      artistSort: "Beatles, The",
      albumSort: "Abbey Road",
    } as Record<string, unknown>;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    assertEquals(encoded["TITLESORT"], "Title, The");
    assertEquals(encoded["ARTISTSORT"], "Beatles, The");
    assertEquals(encoded["ALBUMSORT"], "Abbey Road");
  });

  it("should pass through unknown keys as-is", () => {
    const tag = { title: "Test", CUSTOM_FIELD: "value" } as Record<
      string,
      unknown
    >;
    const encoded = decode(
      encodeTagData(tag as unknown as ExtendedTag),
    ) as Record<string, unknown>;
    assertEquals(encoded["CUSTOM_FIELD"], "value");
  });
});
