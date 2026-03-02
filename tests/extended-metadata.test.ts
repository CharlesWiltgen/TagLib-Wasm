/**
 * @fileoverview Tests for extended metadata fields
 *
 * Tests MusicBrainz IDs, ReplayGain, AcoustID, and other advanced metadata
 */

import { assertEquals, type assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
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
    const taglib = await TagLib.initialize({ forceBufferMode: true });

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
    assertEquals(
      mp3File.getProperty("musicbrainzTrackId"),
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );
    assertEquals(
      mp3File.getProperty("musicbrainzReleaseId"),
      TEST_EXTENDED_METADATA.musicbrainzReleaseId,
    );
    assertEquals(
      mp3File.getProperty("musicbrainzArtistId"),
      TEST_EXTENDED_METADATA.musicbrainzArtistId,
    );

    mp3File.dispose();
  });

  it("MusicBrainz Release Group ID", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const mp3Buffer = await readFileData(TEST_FILES.mp3);
    const file = await taglib.open(mp3Buffer);

    assertEquals(file.getProperty("musicbrainzReleaseGroupId"), undefined);

    file.setProperty(
      "musicbrainzReleaseGroupId",
      TEST_EXTENDED_METADATA.musicbrainzReleaseGroupId,
    );
    file.save();

    assertEquals(
      file.getProperty("musicbrainzReleaseGroupId"),
      TEST_EXTENDED_METADATA.musicbrainzReleaseGroupId,
    );

    // Roundtrip: save to buffer, reopen, verify
    const savedBuffer = file.getFileBuffer();
    file.dispose();

    const file2 = await taglib.open(savedBuffer);
    assertEquals(
      file2.getProperty("musicbrainzReleaseGroupId"),
      TEST_EXTENDED_METADATA.musicbrainzReleaseGroupId,
    );
    file2.dispose();
  });

  it("Total tracks and discs", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const flacBuffer = await readFileData(TEST_FILES.flac);
    const file = await taglib.open(flacBuffer);

    assertEquals(file.getProperty("TRACKTOTAL"), undefined);
    assertEquals(file.getProperty("DISCTOTAL"), undefined);

    file.setProperty("TRACKTOTAL", "12");
    file.setProperty("DISCTOTAL", "2");
    file.save();

    assertEquals(file.getProperty("TRACKTOTAL"), "12");
    assertEquals(file.getProperty("DISCTOTAL"), "2");

    // Roundtrip: save to buffer, reopen, verify
    const savedBuffer = file.getFileBuffer();
    file.dispose();

    const file2 = await taglib.open(savedBuffer);
    assertEquals(file2.getProperty("TRACKTOTAL"), "12");
    assertEquals(file2.getProperty("DISCTOTAL"), "2");
    file2.dispose();
  });

  it("ReplayGain values", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

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
    assertEquals(
      flacFile.getProperty("replayGainTrackGain"),
      TEST_EXTENDED_METADATA.replayGainTrackGain,
    );
    assertEquals(
      flacFile.getProperty("replayGainTrackPeak"),
      TEST_EXTENDED_METADATA.replayGainTrackPeak,
    );
    assertEquals(
      flacFile.getProperty("replayGainAlbumGain"),
      TEST_EXTENDED_METADATA.replayGainAlbumGain,
    );
    assertEquals(
      flacFile.getProperty("replayGainAlbumPeak"),
      TEST_EXTENDED_METADATA.replayGainAlbumPeak,
    );

    flacFile.dispose();
  });

  it("AcoustID fingerprint", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

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
      assertEquals(
        file.getProperty("acoustidFingerprint"),
        TEST_EXTENDED_METADATA.acoustidFingerprint,
      );
      assertEquals(
        file.getProperty("acoustidId"),
        TEST_EXTENDED_METADATA.acoustidId,
      );

      file.dispose();
    }
  });

  it("Apple Sound Check", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

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
    assertEquals(
      m4aFile.getProperty("appleSoundCheck"),
      TEST_EXTENDED_METADATA.appleSoundCheck,
    );

    m4aFile.dispose();
  });

  it("Performance", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
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
    const taglib = await TagLib.initialize({ forceBufferMode: true });

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
      assertEquals(
        file.getProperty("musicbrainzTrackId"),
        TEST_EXTENDED_METADATA.musicbrainzTrackId,
        `MusicBrainz ID should work in ${format}`,
      );
      assertEquals(
        file.getProperty("replayGainTrackGain"),
        TEST_EXTENDED_METADATA.replayGainTrackGain,
        `ReplayGain should work in ${format}`,
      );

      file.dispose();
    }
  });

  it("Persistence after save", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

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

    assertEquals(
      file2.getProperty("musicbrainzTrackId"),
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );
    assertEquals(
      file2.getProperty("musicbrainzReleaseId"),
      TEST_EXTENDED_METADATA.musicbrainzReleaseId,
    );
    assertEquals(
      file2.getProperty("musicbrainzArtistId"),
      TEST_EXTENDED_METADATA.musicbrainzArtistId,
    );
    assertEquals(
      file2.getProperty("replayGainTrackGain"),
      TEST_EXTENDED_METADATA.replayGainTrackGain,
    );
    assertEquals(
      file2.getProperty("replayGainTrackPeak"),
      TEST_EXTENDED_METADATA.replayGainTrackPeak,
    );
    assertEquals(
      file2.getProperty("acoustidFingerprint"),
      TEST_EXTENDED_METADATA.acoustidFingerprint,
    );
    assertEquals(
      file2.getProperty("acoustidId"),
      TEST_EXTENDED_METADATA.acoustidId,
    );

    file2.dispose();
  });

  it("Empty value handling", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const buffer = await readFileData(TEST_FILES.mp3);
    const file = await taglib.open(buffer);

    // Verify unset values return undefined
    assertEquals(file.getProperty("musicbrainzTrackId"), undefined);
    assertEquals(file.getProperty("replayGainTrackGain"), undefined);
    assertEquals(file.getProperty("acoustidFingerprint"), undefined);

    // Set and then clear values
    file.setProperty(
      "musicbrainzTrackId",
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );
    file.save();
    assertEquals(
      file.getProperty("musicbrainzTrackId"),
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );

    // Clear by setting empty string
    file.setProperty("musicbrainzTrackId", "");
    file.save();
    assertEquals(file.getProperty("musicbrainzTrackId"), undefined);

    file.dispose();
  });

  it("PropertyMap integration", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
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
    assertEquals(properties["musicbrainzTrackId"], [
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    ]);
    assertEquals(properties["replayGainTrackGain"], [
      TEST_EXTENDED_METADATA.replayGainTrackGain,
    ]);
    assertEquals(properties["acoustidFingerprint"], [
      TEST_EXTENDED_METADATA.acoustidFingerprint,
    ]);

    // Set via property map
    file.setProperty(
      "musicbrainzReleaseId",
      TEST_EXTENDED_METADATA.musicbrainzReleaseId,
    );
    file.save();

    // Verify via getProperty
    assertEquals(
      file.getProperty("musicbrainzReleaseId"),
      TEST_EXTENDED_METADATA.musicbrainzReleaseId,
    );

    file.dispose();
  });

  it("getProperty/setProperty accept camelCase keys", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const buffer = await readFileData(TEST_FILES.mp3);
    const file = await taglib.open(buffer);

    file.setProperty(
      "musicbrainzTrackId",
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );
    file.save();

    assertEquals(
      file.getProperty("musicbrainzTrackId"),
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );

    file.dispose();
  });

  it("properties() returns camelCase keys", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const buffer = await readFileData(TEST_FILES.flac);
    const file = await taglib.open(buffer);

    file.setProperty(
      "musicbrainzTrackId",
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );
    file.save();

    const props = file.properties();
    assertEquals(props["musicbrainzTrackId"], [
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    ]);
    assertEquals(props["MUSICBRAINZ_TRACKID"], undefined);

    file.dispose();
  });

  it("setProperties() accepts camelCase keys", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const buffer = await readFileData(TEST_FILES.flac);
    const file = await taglib.open(buffer);

    file.setProperties({
      title: ["Test Title"],
      musicbrainzTrackId: [TEST_EXTENDED_METADATA.musicbrainzTrackId],
    });
    file.save();

    assertEquals(file.getProperty("title"), "Test Title");
    assertEquals(
      file.getProperty("musicbrainzTrackId"),
      TEST_EXTENDED_METADATA.musicbrainzTrackId,
    );

    file.dispose();
  });

  it("Complex Apple Sound Check scenarios", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });

    // Test with M4A (native support)
    const m4aBuffer = await readFileData(TEST_FILES.m4a);
    const m4aFile = await taglib.open(m4aBuffer);

    m4aFile.setProperty(
      "appleSoundCheck",
      TEST_EXTENDED_METADATA.appleSoundCheck,
    );
    m4aFile.save();

    // Verify it's accessible via getProperty
    assertEquals(
      m4aFile.getProperty("appleSoundCheck"),
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
    assertEquals(properties["appleSoundCheck"], [
      TEST_EXTENDED_METADATA.appleSoundCheck,
    ]);
    assertEquals(
      mp3File.getProperty("appleSoundCheck"),
      TEST_EXTENDED_METADATA.appleSoundCheck,
    );

    mp3File.dispose();
  });
});
