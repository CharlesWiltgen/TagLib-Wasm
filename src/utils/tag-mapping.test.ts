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

  it("should map extended string fields to camelCase PropertyMap keys", () => {
    const result = normalizeTagInput({
      albumArtist: "VA",
      composer: ["Bach", "Handel"],
      conductor: "Karajan",
      lyricist: ["A", "B"],
    });
    assertEquals(result.albumArtist, ["VA"]);
    assertEquals(result.composer, ["Bach", "Handel"]);
    assertEquals(result.conductor, ["Karajan"]);
    assertEquals(result.lyricist, ["A", "B"]);
  });

  it("should map numeric extended fields as string arrays", () => {
    const result = normalizeTagInput({
      discNumber: 2,
      totalTracks: 12,
      totalDiscs: 3,
      bpm: 128,
    });
    assertEquals(result.discNumber, ["2"]);
    assertEquals(result.totalTracks, ["12"]);
    assertEquals(result.totalDiscs, ["3"]);
    assertEquals(result.bpm, ["128"]);
  });

  it("should handle numeric 0 values", () => {
    const result = normalizeTagInput({ bpm: 0, discNumber: 0 });
    assertEquals(result.bpm, ["0"]);
    assertEquals(result.discNumber, ["0"]);
  });

  it("should map compilation true to '1'", () => {
    const result = normalizeTagInput({ compilation: true });
    assertEquals(result.compilation, ["1"]);
  });

  it("should map compilation false to '0'", () => {
    const result = normalizeTagInput({ compilation: false });
    assertEquals(result.compilation, ["0"]);
  });

  it("should pass through empty arrays", () => {
    const result = normalizeTagInput({ albumArtist: [] });
    assertEquals(result.albumArtist, []);
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
    assertEquals(result.musicbrainzTrackId, ["abc-123"]);
    assertEquals(result.replayGainTrackGain, ["-6.54 dB"]);
  });

  it("should not duplicate basic fields handled by the initial loop", () => {
    const result = normalizeTagInput({ title: "T", artist: ["A", "B"] });
    assertEquals(result.title, ["T"]);
    assertEquals(result.artist, ["A", "B"]);
    assertEquals(Object.keys(result).length, 2);
  });
});
