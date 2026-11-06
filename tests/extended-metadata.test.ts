/**
 * @fileoverview Tests for extended metadata fields
 *
 * Tests MusicBrainz IDs, ReplayGain, AcoustID, and other advanced metadata
 */

import { describe, expect, it } from "vite-plus/test";
import { TagLib } from "../src/taglib.ts";
import { readFileData } from "../src/utils/file.ts";
import {
  type createTestFileWithMetadata,
  measureTime,
  TEST_EXTENDED_METADATA,
  TEST_FILES,
} from "./test-utils.ts";

describe("Extended Metadata", () => {
  it("MusicBrainz IDs", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });

    // Test with MP3 (ID3v2)
    const mp3Buffer = await readFileData(TEST_FILES.mp3);
    const mp3File = await taglib.open(mp3Buffer);

    // Set MusicBrainz IDs
    mp3File.setProperty(
      "musicbrainzTrackId",
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );
    mp3File.setProperty(
      "musicbrainzReleaseId",
      TEST_EXTENDED_METADATA.musicbrainzReleaseId,
    );
    mp3File.setProperty(
      "musicbrainzArtistId",
      TEST_EXTENDED_METADATA.musicbrainzArtistId,
    );

    mp3File.save();

    // Verify the values were saved
    expect(mp3File.getProperty("musicbrainzTrackId")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );
    expect(mp3File.getProperty("musicbrainzReleaseId")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.musicbrainzReleaseId,
    );
    expect(mp3File.getProperty("musicbrainzArtistId")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.musicbrainzArtistId,
    );

    mp3File.dispose();
  });

  it("MusicBrainz Release Group ID", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const mp3Buffer = await readFileData(TEST_FILES.mp3);
    const file = await taglib.open(mp3Buffer);

    expect(file.getProperty("musicbrainzReleaseGroupId")?.[0]).toStrictEqual(
      undefined,
    );

    file.setProperty(
      "musicbrainzReleaseGroupId",
      TEST_EXTENDED_METADATA.musicbrainzReleaseGroupId,
    );
    file.save();

    expect(file.getProperty("musicbrainzReleaseGroupId")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.musicbrainzReleaseGroupId,
    );

    // Roundtrip: save to buffer, reopen, verify
    const savedBuffer = file.getFileBuffer();
    file.dispose();

    const file2 = await taglib.open(savedBuffer);
    expect(file2.getProperty("musicbrainzReleaseGroupId")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.musicbrainzReleaseGroupId,
    );
    file2.dispose();
  });

  it("Total tracks and discs", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const flacBuffer = await readFileData(TEST_FILES.flac);
    const file = await taglib.open(flacBuffer);

    expect(file.getProperty("TRACKTOTAL")?.[0]).toStrictEqual(undefined);
    expect(file.getProperty("DISCTOTAL")?.[0]).toStrictEqual(undefined);

    file.setProperty("TRACKTOTAL", "12");
    file.setProperty("DISCTOTAL", "2");
    file.save();

    expect(file.getProperty("TRACKTOTAL")?.[0]).toStrictEqual("12");
    expect(file.getProperty("DISCTOTAL")?.[0]).toStrictEqual("2");

    // Roundtrip: save to buffer, reopen, verify
    const savedBuffer = file.getFileBuffer();
    file.dispose();

    const file2 = await taglib.open(savedBuffer);
    expect(file2.getProperty("TRACKTOTAL")?.[0]).toStrictEqual("12");
    expect(file2.getProperty("DISCTOTAL")?.[0]).toStrictEqual("2");
    file2.dispose();
  });

  it("Total tracks and discs roundtrip (MP4)", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const m4aBuffer = await readFileData(TEST_FILES.m4a);
    const file = await taglib.open(m4aBuffer);

    file.setProperty("TRACKNUMBER", "3");
    file.setProperty("TRACKTOTAL", "12");
    file.setProperty("DISCNUMBER", "1");
    file.setProperty("DISCTOTAL", "2");
    file.save();

    const savedBuffer = file.getFileBuffer();
    file.dispose();

    const file2 = await taglib.open(savedBuffer);
    // MP4 trkn/disk store the number and total in ONE atom, so a separate
    // TRACKTOTAL/DISCTOTAL must be folded into the pair before TagLib writes
    // it. The old expectations ("3" + "12") pinned the Emscripten-only bug
    // that left the total in a non-standard freeform atom.
    expect(file2.getProperty("TRACKNUMBER")?.[0]).toStrictEqual("3/12");
    expect(file2.getProperty("TRACKTOTAL")?.[0]).toStrictEqual(undefined);
    expect(file2.getProperty("DISCNUMBER")?.[0]).toStrictEqual("1/2");
    expect(file2.getProperty("DISCTOTAL")?.[0]).toStrictEqual(undefined);
    file2.dispose();
  });

  it("Total tracks and discs roundtrip (MP3)", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const mp3Buffer = await readFileData(TEST_FILES.mp3);
    const file = await taglib.open(mp3Buffer);

    file.setProperty("TRACKNUMBER", "7");
    file.setProperty("TRACKTOTAL", "15");
    file.setProperty("DISCNUMBER", "2");
    file.setProperty("DISCTOTAL", "3");
    file.save();

    const savedBuffer = file.getFileBuffer();
    file.dispose();

    const file2 = await taglib.open(savedBuffer);
    // ID3v2 TRCK/TPOS store the number and total in ONE frame, so a separate
    // TRACKTOTAL/DISCTOTAL must be folded into the pair before TagLib writes
    // it. The old expectations ("7" + "15") pinned the Emscripten-only bug
    // that left the total in a non-standard TXXX frame.
    expect(file2.getProperty("TRACKNUMBER")?.[0]).toStrictEqual("7/15");
    expect(file2.getProperty("TRACKTOTAL")?.[0]).toStrictEqual(undefined);
    expect(file2.getProperty("DISCNUMBER")?.[0]).toStrictEqual("2/3");
    expect(file2.getProperty("DISCTOTAL")?.[0]).toStrictEqual(undefined);
    file2.dispose();
  });

  it("ReplayGain values", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });

    // Test with FLAC (native ReplayGain support)
    const flacBuffer = await readFileData(TEST_FILES.flac);
    const flacFile = await taglib.open(flacBuffer);

    // Set ReplayGain values
    flacFile.setProperty(
      "replayGainTrackGain",
      TEST_EXTENDED_METADATA.replayGainTrackGain,
    );
    flacFile.setProperty(
      "replayGainTrackPeak",
      TEST_EXTENDED_METADATA.replayGainTrackPeak,
    );
    flacFile.setProperty(
      "replayGainAlbumGain",
      TEST_EXTENDED_METADATA.replayGainAlbumGain,
    );
    flacFile.setProperty(
      "replayGainAlbumPeak",
      TEST_EXTENDED_METADATA.replayGainAlbumPeak,
    );

    flacFile.save();

    // Verify the values
    expect(flacFile.getProperty("replayGainTrackGain")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.replayGainTrackGain,
    );
    expect(flacFile.getProperty("replayGainTrackPeak")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.replayGainTrackPeak,
    );
    expect(flacFile.getProperty("replayGainAlbumGain")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.replayGainAlbumGain,
    );
    expect(flacFile.getProperty("replayGainAlbumPeak")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.replayGainAlbumPeak,
    );

    flacFile.dispose();
  });

  it("AcoustID fingerprint", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });

    // Test across different formats
    for (const [format, path] of Object.entries(TEST_FILES)) {
      const buffer = await readFileData(path);
      const file = await taglib.open(buffer);

      // Set AcoustID data
      file.setProperty(
        "acoustidFingerprint",
        TEST_EXTENDED_METADATA.acoustidFingerprint,
      );
      file.setProperty("acoustidId", TEST_EXTENDED_METADATA.acoustidId);

      file.save();

      // Verify
      expect(file.getProperty("acoustidFingerprint")?.[0]).toStrictEqual(
        TEST_EXTENDED_METADATA.acoustidFingerprint,
      );
      expect(file.getProperty("acoustidId")?.[0]).toStrictEqual(
        TEST_EXTENDED_METADATA.acoustidId,
      );

      file.dispose();
    }
  });

  it("Apple Sound Check", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });

    // Test with M4A (iTunes metadata)
    const m4aBuffer = await readFileData(TEST_FILES.m4a);
    const m4aFile = await taglib.open(m4aBuffer);

    // Set Apple Sound Check data
    m4aFile.setProperty(
      "appleSoundCheck",
      TEST_EXTENDED_METADATA.appleSoundCheck,
    );

    m4aFile.save();

    // Verify
    expect(m4aFile.getProperty("appleSoundCheck")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.appleSoundCheck,
    );

    m4aFile.dispose();
  });

  it("Performance", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const buffer = await readFileData(TEST_FILES.flac);

    const { timeMs } = await measureTime(async () => {
      const file = await taglib.open(buffer);

      // Set multiple extended fields
      file.setProperty(
        "musicbrainzTrackId",
        TEST_EXTENDED_METADATA.musicbrainzTrackId,
      );
      file.setProperty(
        "replayGainTrackGain",
        TEST_EXTENDED_METADATA.replayGainTrackGain,
      );
      file.setProperty(
        "acoustidFingerprint",
        TEST_EXTENDED_METADATA.acoustidFingerprint,
      );

      file.save();
      file.dispose();
    });

    // Extended metadata operations should be reasonably fast
    // Performance should be under 100ms for basic operations
    console.log(`Extended metadata operations took ${timeMs}ms`);
  });

  it("Cross-format compatibility", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });

    // Test that extended metadata works across all formats
    const formats = ["mp3", "flac", "m4a", "ogg"] as const;

    for (const format of formats) {
      const buffer = await readFileData(TEST_FILES[format]);
      const file = await taglib.open(buffer);

      // Set various extended metadata
      file.setProperty(
        "musicbrainzTrackId",
        TEST_EXTENDED_METADATA.musicbrainzTrackId,
      );
      file.setProperty(
        "replayGainTrackGain",
        TEST_EXTENDED_METADATA.replayGainTrackGain,
      );

      file.save();

      // Verify it was saved
      expect(
        file.getProperty("musicbrainzTrackId")?.[0],
        `MusicBrainz ID should work in ${format}`,
      ).toStrictEqual(TEST_EXTENDED_METADATA.musicbrainzTrackId);
      expect(
        file.getProperty("replayGainTrackGain")?.[0],
        `ReplayGain should work in ${format}`,
      ).toStrictEqual(TEST_EXTENDED_METADATA.replayGainTrackGain);

      file.dispose();
    }
  });

  it("Persistence after save", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });

    // Create a file with extended metadata
    const originalBuffer = await readFileData(TEST_FILES.flac);
    const file = await taglib.open(originalBuffer);

    // Set all extended metadata fields
    file.setProperty(
      "musicbrainzTrackId",
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );
    file.setProperty(
      "musicbrainzReleaseId",
      TEST_EXTENDED_METADATA.musicbrainzReleaseId,
    );
    file.setProperty(
      "musicbrainzArtistId",
      TEST_EXTENDED_METADATA.musicbrainzArtistId,
    );
    file.setProperty(
      "replayGainTrackGain",
      TEST_EXTENDED_METADATA.replayGainTrackGain,
    );
    file.setProperty(
      "replayGainTrackPeak",
      TEST_EXTENDED_METADATA.replayGainTrackPeak,
    );
    file.setProperty(
      "acoustidFingerprint",
      TEST_EXTENDED_METADATA.acoustidFingerprint,
    );
    file.setProperty("acoustidId", TEST_EXTENDED_METADATA.acoustidId);

    file.save();
    const savedBuffer = file.getFileBuffer();
    file.dispose();

    // Re-open the saved file and verify all metadata persists
    const file2 = await taglib.open(savedBuffer);

    expect(file2.getProperty("musicbrainzTrackId")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );
    expect(file2.getProperty("musicbrainzReleaseId")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.musicbrainzReleaseId,
    );
    expect(file2.getProperty("musicbrainzArtistId")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.musicbrainzArtistId,
    );
    expect(file2.getProperty("replayGainTrackGain")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.replayGainTrackGain,
    );
    expect(file2.getProperty("replayGainTrackPeak")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.replayGainTrackPeak,
    );
    expect(file2.getProperty("acoustidFingerprint")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.acoustidFingerprint,
    );
    expect(file2.getProperty("acoustidId")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.acoustidId,
    );

    file2.dispose();
  });

  it("Empty value handling", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const buffer = await readFileData(TEST_FILES.mp3);
    const file = await taglib.open(buffer);

    // Verify unset values return undefined
    expect(file.getProperty("musicbrainzTrackId")?.[0]).toStrictEqual(
      undefined,
    );
    expect(file.getProperty("replayGainTrackGain")?.[0]).toStrictEqual(
      undefined,
    );
    expect(file.getProperty("acoustidFingerprint")?.[0]).toStrictEqual(
      undefined,
    );

    // Set and then clear values
    file.setProperty(
      "musicbrainzTrackId",
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );
    file.save();
    expect(file.getProperty("musicbrainzTrackId")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );

    // Clear by setting empty string
    file.setProperty("musicbrainzTrackId", "");
    file.save();
    expect(file.getProperty("musicbrainzTrackId")?.[0]).toStrictEqual(
      undefined,
    );

    file.dispose();
  });

  it("PropertyMap integration", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const buffer = await readFileData(TEST_FILES.flac);
    const file = await taglib.open(buffer);

    // Set extended metadata via setProperty
    file.setProperty(
      "musicbrainzTrackId",
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );
    file.setProperty(
      "replayGainTrackGain",
      TEST_EXTENDED_METADATA.replayGainTrackGain,
    );
    file.setProperty(
      "acoustidFingerprint",
      TEST_EXTENDED_METADATA.acoustidFingerprint,
    );

    // Verify they appear in the property map
    const properties = file.properties();
    expect(properties["musicbrainzTrackId"]).toStrictEqual([
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    ]);
    expect(properties["replayGainTrackGain"]).toStrictEqual([
      TEST_EXTENDED_METADATA.replayGainTrackGain,
    ]);
    expect(properties["acoustidFingerprint"]).toStrictEqual([
      TEST_EXTENDED_METADATA.acoustidFingerprint,
    ]);

    // Set via property map
    file.setProperty(
      "musicbrainzReleaseId",
      TEST_EXTENDED_METADATA.musicbrainzReleaseId,
    );
    file.save();

    // Verify via getProperty
    expect(file.getProperty("musicbrainzReleaseId")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.musicbrainzReleaseId,
    );

    file.dispose();
  });

  it("getProperty/setProperty accept camelCase keys", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const buffer = await readFileData(TEST_FILES.mp3);
    const file = await taglib.open(buffer);

    file.setProperty(
      "musicbrainzTrackId",
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );
    file.save();

    expect(file.getProperty("musicbrainzTrackId")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );

    file.dispose();
  });

  it("properties() returns camelCase keys", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const buffer = await readFileData(TEST_FILES.flac);
    const file = await taglib.open(buffer);

    file.setProperty(
      "musicbrainzTrackId",
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );
    file.save();

    const props = file.properties();
    expect(props["musicbrainzTrackId"]).toStrictEqual([
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    ]);
    expect(props["MUSICBRAINZ_TRACKID"]).toStrictEqual(undefined);

    file.dispose();
  });

  it("setProperties() accepts camelCase keys", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });
    const buffer = await readFileData(TEST_FILES.flac);
    const file = await taglib.open(buffer);

    file.setProperties({
      title: ["Test Title"],
      musicbrainzTrackId: [TEST_EXTENDED_METADATA.musicbrainzTrackId],
    });
    file.save();

    expect(file.getProperty("title")?.[0]).toStrictEqual("Test Title");
    expect(file.getProperty("musicbrainzTrackId")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );

    file.dispose();
  });

  it("Complex Apple Sound Check scenarios", async () => {
    const taglib = await TagLib.initialize({ forceWasmType: "emscripten" });

    // Test with M4A (native support)
    const m4aBuffer = await readFileData(TEST_FILES.m4a);
    const m4aFile = await taglib.open(m4aBuffer);

    m4aFile.setProperty(
      "appleSoundCheck",
      TEST_EXTENDED_METADATA.appleSoundCheck,
    );
    m4aFile.save();

    // Verify it's accessible via getProperty
    expect(m4aFile.getProperty("appleSoundCheck")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.appleSoundCheck,
    );

    m4aFile.dispose();

    // Test with non-M4A format (should use properties)
    const mp3Buffer = await readFileData(TEST_FILES.mp3);
    const mp3File = await taglib.open(mp3Buffer);

    mp3File.setProperty(
      "appleSoundCheck",
      TEST_EXTENDED_METADATA.appleSoundCheck,
    );
    mp3File.save();

    // Verify it's stored in properties
    const properties = mp3File.properties();
    expect(properties["appleSoundCheck"]).toStrictEqual([
      TEST_EXTENDED_METADATA.appleSoundCheck,
    ]);
    expect(mp3File.getProperty("appleSoundCheck")?.[0]).toStrictEqual(
      TEST_EXTENDED_METADATA.appleSoundCheck,
    );

    mp3File.dispose();
  });
});
