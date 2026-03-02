import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  mapPropertiesToExtendedTag,
  normalizeTagInput,
} from "./tag-mapping.ts";

describe(mapPropertiesToExtendedTag.name, () => {
  it("should map basic fields", () => {
    const result = mapPropertiesToExtendedTag({
      title: ["Hello"],
      artist: ["Artist"],
      date: ["2025"],
      trackNumber: ["3"],
    });
    assertEquals(result, {
      title: ["Hello"],
      artist: ["Artist"],
      year: 2025,
      track: 3,
    });
  });

  it("should map extended string fields", () => {
    const result = mapPropertiesToExtendedTag({
      albumArtist: ["Various Artists"],
      composer: ["Bach", "Handel"],
      musicbrainzTrackId: ["abc-123"],
      replayGainTrackGain: ["-6.54 dB"],
    });
    assertEquals(result, {
      albumArtist: ["Various Artists"],
      composer: ["Bach", "Handel"],
      musicbrainzTrackId: ["abc-123"],
      replayGainTrackGain: ["-6.54 dB"],
    });
  });

  it("should map numeric extended fields", () => {
    const result = mapPropertiesToExtendedTag({
      discNumber: ["2"],
      totalTracks: ["12"],
      totalDiscs: ["3"],
      bpm: ["128"],
    });
    assertEquals(result, {
      discNumber: 2,
      totalTracks: 12,
      totalDiscs: 3,
      bpm: 128,
    });
  });

  it("should map compilation to boolean", () => {
    assertEquals(
      mapPropertiesToExtendedTag({ compilation: ["1"] }).compilation,
      true,
    );
    assertEquals(
      mapPropertiesToExtendedTag({ compilation: ["0"] }).compilation,
      false,
    );
  });

  it("should pass through unknown camelCase property keys", () => {
    const result = mapPropertiesToExtendedTag({
      title: ["X"],
      someUnknownKey: ["kept"],
    });
    assertEquals(result.title, ["X"]);
    assertEquals(
      (result as Record<string, unknown>).someUnknownKey,
      ["kept"],
    );
  });

  it("should skip fields with empty values arrays", () => {
    const result = mapPropertiesToExtendedTag({
      title: [],
      albumArtist: [],
      discNumber: [],
      compilation: [],
    });
    assertEquals(result, {});
  });

  it("should return undefined for non-numeric year and track", () => {
    const result = mapPropertiesToExtendedTag({
      date: ["not-a-number"],
      trackNumber: ["abc"],
    });
    assertEquals(result, {});
  });
});

describe(normalizeTagInput.name, () => {
  it("should map basic string fields to camelCase PropertyMap keys", () => {
    const result = normalizeTagInput({
      title: "Hello",
      artist: ["A", "B"],
      album: "Album",
    });
    assertEquals(result.title, ["Hello"]);
    assertEquals(result.artist, ["A", "B"]);
    assertEquals(result.album, ["Album"]);
  });

  it("should map year and track as string arrays", () => {
    const result = normalizeTagInput({ year: 2025, track: 3 });
    assertEquals(result.date, ["2025"]);
    assertEquals(result.trackNumber, ["3"]);
  });

  it("should map extended string fields to ALL_CAPS PropertyMap keys", () => {
    const result = normalizeTagInput({
      albumArtist: "VA",
      composer: ["Bach", "Handel"],
      conductor: "Karajan",
      lyricist: ["A", "B"],
    });
    assertEquals(result.ALBUMARTIST, ["VA"]);
    assertEquals(result.COMPOSER, ["Bach", "Handel"]);
    assertEquals(result.CONDUCTOR, ["Karajan"]);
    assertEquals(result.LYRICIST, ["A", "B"]);
  });

  it("should map numeric extended fields as string arrays", () => {
    const result = normalizeTagInput({
      discNumber: 2,
      totalTracks: 12,
      totalDiscs: 3,
      bpm: 128,
    });
    assertEquals(result.DISCNUMBER, ["2"]);
    assertEquals(result.TRACKTOTAL, ["12"]);
    assertEquals(result.DISCTOTAL, ["3"]);
    assertEquals(result.BPM, ["128"]);
  });

  it("should handle numeric 0 values", () => {
    const result = normalizeTagInput({ bpm: 0, discNumber: 0 });
    assertEquals(result.BPM, ["0"]);
    assertEquals(result.DISCNUMBER, ["0"]);
  });

  it("should map compilation true to '1'", () => {
    const result = normalizeTagInput({ compilation: true });
    assertEquals(result.COMPILATION, ["1"]);
  });

  it("should map compilation false to '0'", () => {
    const result = normalizeTagInput({ compilation: false });
    assertEquals(result.COMPILATION, ["0"]);
  });

  it("should pass through empty arrays", () => {
    const result = normalizeTagInput({ albumArtist: [] });
    assertEquals(result.ALBUMARTIST, []);
  });

  it("should skip undefined fields", () => {
    const result = normalizeTagInput({ title: "X" });
    assertEquals(Object.keys(result), ["title"]);
  });

  it("should map MusicBrainz and ReplayGain fields", () => {
    const result = normalizeTagInput({
      musicbrainzTrackId: "abc-123",
      replayGainTrackGain: "-6.54 dB",
    });
    assertEquals(result.MUSICBRAINZ_TRACKID, ["abc-123"]);
    assertEquals(result.REPLAYGAIN_TRACK_GAIN, ["-6.54 dB"]);
  });

  it("should not duplicate basic fields handled by the initial loop", () => {
    const result = normalizeTagInput({ title: "T", artist: ["A", "B"] });
    assertEquals(result.title, ["T"]);
    assertEquals(result.artist, ["A", "B"]);
    assertEquals(Object.keys(result).length, 2);
  });
});
