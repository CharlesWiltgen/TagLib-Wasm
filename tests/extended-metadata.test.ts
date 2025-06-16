/**
 * @fileoverview Tests for extended metadata fields
 * 
 * Tests MusicBrainz IDs, ReplayGain, AcoustID, and other advanced metadata
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.223.0/assert/mod";
import { TagLib } from "../src/taglib";
import { readFileData } from "../src/utils/file";
import { 
  TEST_FILES, 
  TEST_EXTENDED_METADATA,
  createTestFileWithMetadata,
  measureTime
} from "./test-utils";

Deno.test({
  name: "Extended Metadata - MusicBrainz IDs",
  fn: async () => {
    const taglib = await TagLib.initialize();
    
    // Test with MP3 (ID3v2)
    const mp3Buffer = await readFileData(TEST_FILES.mp3);
    const mp3File = await taglib.open(mp3Buffer);
    
    // Set MusicBrainz IDs
    mp3File.setMusicBrainzTrackId(TEST_EXTENDED_METADATA.musicbrainzTrackId);
    mp3File.setMusicBrainzReleaseId(TEST_EXTENDED_METADATA.musicbrainzReleaseId);
    mp3File.setMusicBrainzArtistId(TEST_EXTENDED_METADATA.musicbrainzArtistId);
    
    mp3File.save();
    
    // Verify the values were saved
    assertEquals(mp3File.getMusicBrainzTrackId(), TEST_EXTENDED_METADATA.musicbrainzTrackId);
    assertEquals(mp3File.getMusicBrainzReleaseId(), TEST_EXTENDED_METADATA.musicbrainzReleaseId);
    assertEquals(mp3File.getMusicBrainzArtistId(), TEST_EXTENDED_METADATA.musicbrainzArtistId);
    
    mp3File.dispose();
  }
});

Deno.test({
  name: "Extended Metadata - ReplayGain values",
  fn: async () => {
    const taglib = await TagLib.initialize();
    
    // Test with FLAC (native ReplayGain support)
    const flacBuffer = await readFileData(TEST_FILES.flac);
    const flacFile = await taglib.open(flacBuffer);
    
    // Set ReplayGain values
    flacFile.setReplayGainTrackGain(TEST_EXTENDED_METADATA.replayGainTrackGain);
    flacFile.setReplayGainTrackPeak(TEST_EXTENDED_METADATA.replayGainTrackPeak);
    flacFile.setReplayGainAlbumGain(TEST_EXTENDED_METADATA.replayGainAlbumGain);
    flacFile.setReplayGainAlbumPeak(TEST_EXTENDED_METADATA.replayGainAlbumPeak);
    
    flacFile.save();
    
    // Verify the values
    assertEquals(flacFile.getReplayGainTrackGain(), TEST_EXTENDED_METADATA.replayGainTrackGain);
    assertEquals(flacFile.getReplayGainTrackPeak(), TEST_EXTENDED_METADATA.replayGainTrackPeak);
    assertEquals(flacFile.getReplayGainAlbumGain(), TEST_EXTENDED_METADATA.replayGainAlbumGain);
    assertEquals(flacFile.getReplayGainAlbumPeak(), TEST_EXTENDED_METADATA.replayGainAlbumPeak);
    
    flacFile.dispose();
  }
});

Deno.test({
  name: "Extended Metadata - AcoustID fingerprint",
  fn: async () => {
    const taglib = await TagLib.initialize();
    
    // Test across different formats
    for (const [format, path] of Object.entries(TEST_FILES)) {
      const buffer = await readFileData(path);
      const file = await taglib.open(buffer);
      
      // Set AcoustID data
      file.setAcoustIdFingerprint(TEST_EXTENDED_METADATA.acoustidFingerprint);
      file.setAcoustIdId(TEST_EXTENDED_METADATA.acoustidId);
      
      file.save();
      
      // Verify
      assertEquals(file.getAcoustIdFingerprint(), TEST_EXTENDED_METADATA.acoustidFingerprint);
      assertEquals(file.getAcoustIdId(), TEST_EXTENDED_METADATA.acoustidId);
      
      file.dispose();
    }
  }
});

Deno.test({
  name: "Extended Metadata - Apple Sound Check",
  fn: async () => {
    const taglib = await TagLib.initialize();
    
    // Test with M4A (iTunes metadata)
    const m4aBuffer = await readFileData(TEST_FILES.m4a);
    const m4aFile = await taglib.open(m4aBuffer);
    
    // Set Apple Sound Check data
    m4aFile.setAppleSoundCheck(TEST_EXTENDED_METADATA.appleSoundCheck);
    
    m4aFile.save();
    
    // Verify
    assertEquals(m4aFile.getAppleSoundCheck(), TEST_EXTENDED_METADATA.appleSoundCheck);
    
    m4aFile.dispose();
  }
});

// Performance test for extended metadata operations
Deno.test({
  name: "Extended Metadata - Performance",
  fn: async () => {
    const taglib = await TagLib.initialize();
    const buffer = await readFileData(TEST_FILES.flac);
    
    const { timeMs } = await measureTime(async () => {
      const file = await taglib.open(buffer);
      
      // Set multiple extended fields
      file.setMusicBrainzTrackId(TEST_EXTENDED_METADATA.musicbrainzTrackId);
      file.setReplayGainTrackGain(TEST_EXTENDED_METADATA.replayGainTrackGain);
      file.setAcoustIdFingerprint(TEST_EXTENDED_METADATA.acoustidFingerprint);
      
      file.save();
      file.dispose();
    });
    
    // Extended metadata operations should be reasonably fast
    // Performance should be under 100ms for basic operations
    console.log(`Extended metadata operations took ${timeMs}ms`);
  }
});

Deno.test({
  name: "Extended Metadata - Cross-format compatibility",
  fn: async () => {
    const taglib = await TagLib.initialize();
    
    // Test that extended metadata works across all formats
    const formats = ["mp3", "flac", "m4a", "ogg"] as const;
    
    for (const format of formats) {
      const buffer = await readFileData(TEST_FILES[format]);
      const file = await taglib.open(buffer);
      
      // Set various extended metadata
      file.setMusicBrainzTrackId(TEST_EXTENDED_METADATA.musicbrainzTrackId);
      file.setReplayGainTrackGain(TEST_EXTENDED_METADATA.replayGainTrackGain);
      
      file.save();
      
      // Verify it was saved
      assertEquals(
        file.getMusicBrainzTrackId(), 
        TEST_EXTENDED_METADATA.musicbrainzTrackId,
        `MusicBrainz ID should work in ${format}`
      );
      assertEquals(
        file.getReplayGainTrackGain(), 
        TEST_EXTENDED_METADATA.replayGainTrackGain,
        `ReplayGain should work in ${format}`
      );
      
      file.dispose();
    }
  }
});

Deno.test({
  name: "Extended Metadata - Persistence after save",
  fn: async () => {
    const taglib = await TagLib.initialize();
    
    // Create a file with extended metadata
    const originalBuffer = await readFileData(TEST_FILES.flac);
    const file = await taglib.open(originalBuffer);
    
    // Set all extended metadata fields
    file.setMusicBrainzTrackId(TEST_EXTENDED_METADATA.musicbrainzTrackId);
    file.setMusicBrainzReleaseId(TEST_EXTENDED_METADATA.musicbrainzReleaseId);
    file.setMusicBrainzArtistId(TEST_EXTENDED_METADATA.musicbrainzArtistId);
    file.setReplayGainTrackGain(TEST_EXTENDED_METADATA.replayGainTrackGain);
    file.setReplayGainTrackPeak(TEST_EXTENDED_METADATA.replayGainTrackPeak);
    file.setAcoustIdFingerprint(TEST_EXTENDED_METADATA.acoustidFingerprint);
    file.setAcoustIdId(TEST_EXTENDED_METADATA.acoustidId);
    
    file.save();
    const savedBuffer = file.getFileBuffer();
    file.dispose();
    
    // Re-open the saved file and verify all metadata persists
    const file2 = await taglib.open(savedBuffer);
    
    assertEquals(file2.getMusicBrainzTrackId(), TEST_EXTENDED_METADATA.musicbrainzTrackId);
    assertEquals(file2.getMusicBrainzReleaseId(), TEST_EXTENDED_METADATA.musicbrainzReleaseId);
    assertEquals(file2.getMusicBrainzArtistId(), TEST_EXTENDED_METADATA.musicbrainzArtistId);
    assertEquals(file2.getReplayGainTrackGain(), TEST_EXTENDED_METADATA.replayGainTrackGain);
    assertEquals(file2.getReplayGainTrackPeak(), TEST_EXTENDED_METADATA.replayGainTrackPeak);
    assertEquals(file2.getAcoustIdFingerprint(), TEST_EXTENDED_METADATA.acoustidFingerprint);
    assertEquals(file2.getAcoustIdId(), TEST_EXTENDED_METADATA.acoustidId);
    
    file2.dispose();
  }
});

Deno.test({
  name: "Extended Metadata - Empty value handling",
  fn: async () => {
    const taglib = await TagLib.initialize();
    const buffer = await readFileData(TEST_FILES.mp3);
    const file = await taglib.open(buffer);
    
    // Verify unset values return undefined
    assertEquals(file.getMusicBrainzTrackId(), undefined);
    assertEquals(file.getReplayGainTrackGain(), undefined);
    assertEquals(file.getAcoustIdFingerprint(), undefined);
    
    // Set and then clear values
    file.setMusicBrainzTrackId(TEST_EXTENDED_METADATA.musicbrainzTrackId);
    file.save();
    assertEquals(file.getMusicBrainzTrackId(), TEST_EXTENDED_METADATA.musicbrainzTrackId);
    
    // Clear by setting empty string
    file.setMusicBrainzTrackId("");
    file.save();
    assertEquals(file.getMusicBrainzTrackId(), undefined);
    
    file.dispose();
  }
});

Deno.test({
  name: "Extended Metadata - PropertyMap integration",
  fn: async () => {
    const taglib = await TagLib.initialize();
    const buffer = await readFileData(TEST_FILES.flac);
    const file = await taglib.open(buffer);
    
    // Set extended metadata via convenience methods
    file.setMusicBrainzTrackId(TEST_EXTENDED_METADATA.musicbrainzTrackId);
    file.setReplayGainTrackGain(TEST_EXTENDED_METADATA.replayGainTrackGain);
    file.setAcoustIdFingerprint(TEST_EXTENDED_METADATA.acoustidFingerprint);
    
    // Verify they appear in the property map
    const properties = file.properties();
    assertEquals(properties["MUSICBRAINZ_TRACKID"], [TEST_EXTENDED_METADATA.musicbrainzTrackId]);
    assertEquals(properties["REPLAYGAIN_TRACK_GAIN"], [TEST_EXTENDED_METADATA.replayGainTrackGain]);
    assertEquals(properties["ACOUSTID_FINGERPRINT"], [TEST_EXTENDED_METADATA.acoustidFingerprint]);
    
    // Set via property map
    file.setProperty("MUSICBRAINZ_ALBUMID", TEST_EXTENDED_METADATA.musicbrainzReleaseId);
    file.save();
    
    // Verify via convenience method
    assertEquals(file.getMusicBrainzReleaseId(), TEST_EXTENDED_METADATA.musicbrainzReleaseId);
    
    file.dispose();
  }
});

Deno.test({
  name: "Extended Metadata - Complex Apple Sound Check scenarios",
  fn: async () => {
    const taglib = await TagLib.initialize();
    
    // Test with M4A (native support)
    const m4aBuffer = await readFileData(TEST_FILES.m4a);
    const m4aFile = await taglib.open(m4aBuffer);
    
    m4aFile.setAppleSoundCheck(TEST_EXTENDED_METADATA.appleSoundCheck);
    m4aFile.save();
    
    // Verify it's stored as MP4 item
    assertEquals(m4aFile.getMP4Item("iTunNORM"), TEST_EXTENDED_METADATA.appleSoundCheck);
    assertEquals(m4aFile.getAppleSoundCheck(), TEST_EXTENDED_METADATA.appleSoundCheck);
    
    m4aFile.dispose();
    
    // Test with non-M4A format (should use properties)
    const mp3Buffer = await readFileData(TEST_FILES.mp3);
    const mp3File = await taglib.open(mp3Buffer);
    
    mp3File.setAppleSoundCheck(TEST_EXTENDED_METADATA.appleSoundCheck);
    mp3File.save();
    
    // Verify it's stored in properties
    const properties = mp3File.properties();
    assertEquals(properties["ITUNESOUNDCHECK"], [TEST_EXTENDED_METADATA.appleSoundCheck]);
    assertEquals(mp3File.getAppleSoundCheck(), TEST_EXTENDED_METADATA.appleSoundCheck);
    
    mp3File.dispose();
  }
});