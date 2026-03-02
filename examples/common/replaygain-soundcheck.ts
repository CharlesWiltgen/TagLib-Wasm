#!/usr/bin/env -S deno run --allow-read

/**
 * ReplayGain and Apple Sound Check Example
 *
 * This example demonstrates format-agnostic ReplayGain and Apple Sound Check
 * metadata handling that automatically stores normalization data in the correct
 * location for each format:
 *
 * ReplayGain:
 * - MP3: TXXX frames with ReplayGain_Track_Gain, ReplayGain_Track_Peak, etc.
 * - FLAC/OGG: REPLAYGAIN_TRACK_GAIN, REPLAYGAIN_TRACK_PEAK Vorbis comments
 * - MP4: Freeform atoms with com.apple.iTunes:replaygain_* naming
 *
 * Apple Sound Check:
 * - MP3: TXXX frame with "iTunNORM" description
 * - FLAC/OGG: ITUNNORM Vorbis comment
 * - MP4: ----:com.apple.iTunes:iTunNORM atom
 */

import { TagLib } from "../../index.ts";
import { METADATA_MAPPINGS } from "../../src/types.ts";

async function demonstrateReplayGainAndSoundCheck() {
  console.log("🔊 TagLib-Wasm - ReplayGain & Apple Sound Check Example");
  console.log("=".repeat(60));

  try {
    const taglib = await TagLib.initialize();

    // Sample ReplayGain values (typical from analysis tools)
    const replayGainData = {
      trackGain: "-6.54 dB", // Track needs to be reduced by 6.54 dB
      trackPeak: "0.987654", // Peak sample value (0.0-1.0)
      albumGain: "-8.12 dB", // Album-level normalization
      albumPeak: "0.995432", // Album peak value
    };

    // Sample Apple Sound Check data (hex string format used by iTunes)
    const appleSoundCheckData =
      "00000150 00000150 00000150 00000150 00024CA0 00024CA0 00007FFF 00007FFF 00024CA0 00024CA0";

    const testFiles = [
      { path: "./tests/test-files/mp3/kiss-snippet.mp3", format: "MP3" },
      { path: "./tests/test-files/flac/kiss-snippet.flac", format: "FLAC" },
      { path: "./tests/test-files/ogg/kiss-snippet.ogg", format: "OGG" },
      { path: "./tests/test-files/mp4/kiss-snippet.m4a", format: "MP4" },
    ];

    for (const { path, format } of testFiles) {
      console.log(`\\n📁 Processing ${format} file: ${path}`);

      const file = await taglib.open(path);

      if (!file.isValid()) {
        console.log(`❌ Failed to load ${format} file`);
        continue;
      }

      // Show current ReplayGain and Sound Check data
      console.log("\\n🎚️  Current Volume Normalization Metadata:");
      const currentTags = {
        replayGainTrackGain: file.getProperty("replayGainTrackGain"),
        replayGainTrackPeak: file.getProperty("replayGainTrackPeak"),
        replayGainAlbumGain: file.getProperty("replayGainAlbumGain"),
        replayGainAlbumPeak: file.getProperty("replayGainAlbumPeak"),
        appleSoundCheck: format === "M4A"
          ? file.getMP4Item("----:com.apple.iTunes:iTunNORM")
          : undefined,
      };
      console.log(
        `  ReplayGain Track Gain: ${
          currentTags.replayGainTrackGain || "(none)"
        }`,
      );
      console.log(
        `  ReplayGain Track Peak: ${
          currentTags.replayGainTrackPeak || "(none)"
        }`,
      );
      console.log(
        `  ReplayGain Album Gain: ${
          currentTags.replayGainAlbumGain || "(none)"
        }`,
      );
      console.log(
        `  ReplayGain Album Peak: ${
          currentTags.replayGainAlbumPeak || "(none)"
        }`,
      );
      console.log(
        `  Apple Sound Check: ${currentTags.appleSoundCheck || "(none)"}`,
      );

      // Demonstrate format-agnostic field setting
      console.log(`\\n✏️  Setting normalization metadata (format-agnostic)...`);

      // Using PropertyMap API for volume normalization metadata
      // Note: Property keys may vary by format
      file.setProperty("replayGainTrackGain", replayGainData.trackGain);
      file.setProperty("replayGainTrackPeak", replayGainData.trackPeak);
      file.setProperty("replayGainAlbumGain", replayGainData.albumGain);
      file.setProperty("replayGainAlbumPeak", replayGainData.albumPeak);

      // Apple Sound Check may require special handling for MP4
      if (format === "M4A") {
        file.setMP4Item("----:com.apple.iTunes:iTunNORM", appleSoundCheckData);
      }

      // Show where these would be stored for this format
      console.log(`\\n📋 Format-specific storage for ${format}:`);

      const trackGainMapping = METADATA_MAPPINGS.replayGainTrackGain;
      const trackPeakMapping = METADATA_MAPPINGS.replayGainTrackPeak;
      const albumGainMapping = METADATA_MAPPINGS.replayGainAlbumGain;
      const albumPeakMapping = METADATA_MAPPINGS.replayGainAlbumPeak;
      const soundCheckMapping = METADATA_MAPPINGS.appleSoundCheck;

      if (format === "MP3") {
        console.log("  ReplayGain fields stored as ID3v2 TXXX frames:");
        console.log(
          `    • ${trackGainMapping.id3v2?.frame} (${trackGainMapping.id3v2?.description})`,
        );
        console.log(
          `    • ${trackPeakMapping.id3v2?.frame} (${trackPeakMapping.id3v2?.description})`,
        );
        console.log(
          `    • ${albumGainMapping.id3v2?.frame} (${albumGainMapping.id3v2?.description})`,
        );
        console.log(
          `    • ${albumPeakMapping.id3v2?.frame} (${albumPeakMapping.id3v2?.description})`,
        );
        console.log(
          `  Apple Sound Check → ${soundCheckMapping.id3v2?.frame} (${soundCheckMapping.id3v2?.description})`,
        );
      } else if (format === "FLAC" || format === "OGG") {
        console.log("  ReplayGain fields stored as Vorbis Comments:");
        console.log(`    • ${trackGainMapping.vorbis}`);
        console.log(`    • ${trackPeakMapping.vorbis}`);
        console.log(`    • ${albumGainMapping.vorbis}`);
        console.log(`    • ${albumPeakMapping.vorbis}`);
        console.log(`  Apple Sound Check → ${soundCheckMapping.vorbis}`);
      } else if (format === "MP4") {
        console.log("  ReplayGain fields stored as freeform atoms:");
        console.log(`    • ${trackGainMapping.mp4}`);
        console.log(`    • ${trackPeakMapping.mp4}`);
        console.log(`    • ${albumGainMapping.mp4}`);
        console.log(`    • ${albumPeakMapping.mp4}`);
        console.log(`  Apple Sound Check → ${soundCheckMapping.mp4}`);
      }

      console.log(
        `\\n⚠️  Note: Volume normalization writing requires PropertyMap implementation in C++`,
      );

      file.dispose();
    }

    console.log("\\n" + "=".repeat(60));
    console.log("🎯 Key Benefits of Format-Agnostic Volume Normalization:");
    console.log("• Single API for both ReplayGain and Apple Sound Check");
    console.log("• Automatic mapping to format-specific storage locations");
    console.log(
      "• No need to know TXXX frame descriptions or Vorbis field names",
    );
    console.log("• Consistent behavior across all audio formats");
    console.log("• Professional audio library integration ready");

    console.log("\\n🔧 Integration Examples:");
    console.log("• Music library management (automatic volume normalization)");
    console.log("• Audio mastering tools (ReplayGain calculation & storage)");
    console.log("• Apple ecosystem compatibility (Sound Check support)");
    console.log("• Cross-platform audio applications");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

function showNormalizationMappingTable() {
  console.log("\\n" + "=".repeat(60));
  console.log("📊 Volume Normalization Metadata Mapping Reference");
  console.log("=".repeat(60));

  console.log("\\n🎚️ ReplayGain Fields:");
  console.log(
    "┌─────────────────┬──────────────────────────────────────┬─────────────────────┬──────────────────────────────────────┐",
  );
  console.log(
    "│ Field           │ MP3 (ID3v2)                         │ FLAC/OGG (Vorbis)  │ MP4/M4A (Atoms)                     │",
  );
  console.log(
    "├─────────────────┼──────────────────────────────────────┼─────────────────────┼──────────────────────────────────────┤",
  );
  console.log(
    "│ Track Gain      │ TXXX:ReplayGain_Track_Gain          │ REPLAYGAIN_TRACK_GAIN│ ----:com.apple.iTunes:replaygain... │",
  );
  console.log(
    "│ Track Peak      │ TXXX:ReplayGain_Track_Peak          │ REPLAYGAIN_TRACK_PEAK│ ----:com.apple.iTunes:replaygain... │",
  );
  console.log(
    "│ Album Gain      │ TXXX:ReplayGain_Album_Gain          │ REPLAYGAIN_ALBUM_GAIN│ ----:com.apple.iTunes:replaygain... │",
  );
  console.log(
    "│ Album Peak      │ TXXX:ReplayGain_Album_Peak          │ REPLAYGAIN_ALBUM_PEAK│ ----:com.apple.iTunes:replaygain... │",
  );
  console.log(
    "└─────────────────┴──────────────────────────────────────┴─────────────────────┴──────────────────────────────────────┘",
  );

  console.log("\\n🍎 Apple Sound Check:");
  console.log(
    "┌─────────────────┬──────────────────────────────────────┬─────────────────────┬──────────────────────────────────────┐",
  );
  console.log(
    "│ Field           │ MP3 (ID3v2)                         │ FLAC/OGG (Vorbis)  │ MP4/M4A (Atoms)                     │",
  );
  console.log(
    "├─────────────────┼──────────────────────────────────────┼─────────────────────┼──────────────────────────────────────┤",
  );
  console.log(
    "│ Sound Check     │ TXXX:iTunNORM                       │ ITUNNORM            │ ----:com.apple.iTunes:iTunNORM      │",
  );
  console.log(
    "└─────────────────┴──────────────────────────────────────┴─────────────────────┴──────────────────────────────────────┘",
  );

  console.log("\\n💡 Usage Examples:");
  console.log("```typescript");
  console.log("// ReplayGain - Using PropertyMap API");
  console.log('file.setProperty("replayGainTrackGain", "-6.54 dB");');
  console.log('file.setProperty("replayGainTrackPeak", "0.987654");');
  console.log("");
  console.log("// Apple Sound Check for MP4 files");
  console.log("if (file.isMP4()) {");
  console.log(
    '  file.setMP4Item("----:com.apple.iTunes:iTunNORM", "00000150 00000150 00000150...");',
  );
  console.log("}");
  console.log("");
  console.log("// Bulk setting using setProperties");
  console.log("file.setProperties({");
  console.log('  replayGainTrackGain: ["-6.54 dB"],');
  console.log('  replayGainTrackPeak: ["0.987654"],');
  console.log('  replayGainAlbumGain: ["-8.12 dB"],');
  console.log('  replayGainAlbumPeak: ["0.995432"],');
  console.log("});");
  console.log("```");

  console.log("\\n📖 Technical Notes:");
  console.log(
    "• ReplayGain values: Track/Album gain in dB, peak as decimal 0.0-1.0",
  );
  console.log(
    "• Apple Sound Check: Hex string format used by iTunes/Apple Music",
  );
  console.log("• Format detection: Automatic based on file type");
  console.log("• Storage location: Follows industry standard conventions");
}

// Run the examples
if (import.meta.main) {
  await demonstrateReplayGainAndSoundCheck();
  showNormalizationMappingTable();
}
