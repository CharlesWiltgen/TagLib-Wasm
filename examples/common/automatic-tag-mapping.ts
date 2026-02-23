#!/usr/bin/env -S deno run --allow-read

/**
 * Automatic Tag Mapping Handling Example
 *
 * This example demonstrates the format-agnostic metadata system that automatically
 * handles storing fields like AcoustID fingerprints in the correct location for each format:
 *
 * - MP3: TXXX frames with specific descriptions
 * - FLAC/OGG: Vorbis comment fields
 * - MP4/M4A: Freeform atoms with reverse-DNS naming
 * - WAV: INFO chunk fields
 */

import { TagLib, Tags } from "../../index.ts";
import { METADATA_MAPPINGS } from "../../src/types.ts";

async function demonstrateAdvancedMetadata() {
  console.log("🎵 TagLib-Wasm - Automatic Tag Mapping Example");
  console.log("=".repeat(50));

  try {
    const taglib = await TagLib.initialize();

    // Load different format files to show format-agnostic handling
    const testFiles = [
      { path: "./tests/test-files/mp3/kiss-snippet.mp3", format: "MP3" },
      { path: "./tests/test-files/flac/kiss-snippet.flac", format: "FLAC" },
      { path: "./tests/test-files/ogg/kiss-snippet.ogg", format: "OGG" },
      { path: "./tests/test-files/mp4/kiss-snippet.m4a", format: "MP4" },
    ];

    for (const { path, format } of testFiles) {
      console.log(`\n📁 Processing ${format} file: ${path}`);

      const file = await taglib.open(path);

      if (!file.isValid()) {
        console.log(`❌ Failed to load ${format} file`);
        continue;
      }

      // Show current extended metadata using PropertyMap
      console.log("\n🏷️  Current Extended Metadata:");
      const properties = file.properties();
      console.log(
        `  AcoustID Fingerprint: ${
          properties[Tags.AcoustidFingerprint]?.[0] || "(none)"
        }`,
      );
      console.log(
        `  AcoustID ID: ${properties[Tags.AcoustidId]?.[0] || "(none)"}`,
      );
      console.log(
        `  MusicBrainz Track ID: ${
          properties[Tags.MusicBrainzTrackId]?.[0] || "(none)"
        }`,
      );
      console.log(
        `  Album Artist: ${properties[Tags.AlbumArtist]?.[0] || "(none)"}`,
      );
      console.log(`  Composer: ${properties[Tags.Composer]?.[0] || "(none)"}`);

      // Demonstrate format-agnostic field setting
      console.log("\n✏️  Setting automatic tag mapping (format-agnostic)...");

      // Using PropertyMap API for extended metadata with tag constants
      file.setProperty(
        Tags.AcoustidFingerprint,
        "AQADtMmybfGO8NCNEESLnzHyXNOHeHnG4wccz9DR_gGNT_",
      );
      file.setProperty(Tags.AcoustidId, "e7359e88-f1f7-41ed-b9f6-16e58e906997");
      file.setProperty(
        Tags.MusicBrainzTrackId,
        "f4d1b6b8-8c1e-4d9a-9f2a-1234567890ab",
      );

      // Show where these would be stored for this format
      console.log(`\n📋 Format-specific storage for ${format}:`);

      const acoustidFingerprintMapping = METADATA_MAPPINGS.acoustidFingerprint;
      const acoustidIdMapping = METADATA_MAPPINGS.acoustidId;
      const mbTrackIdMapping = METADATA_MAPPINGS.musicbrainzTrackId;

      if (format === "MP3") {
        console.log(
          `  AcoustID Fingerprint → ${acoustidFingerprintMapping.id3v2?.frame} (${acoustidFingerprintMapping.id3v2?.description})`,
        );
        console.log(
          `  AcoustID ID → ${acoustidIdMapping.id3v2?.frame} (${acoustidIdMapping.id3v2?.description})`,
        );
        console.log(
          `  MusicBrainz Track ID → ${mbTrackIdMapping.id3v2?.frame} (${mbTrackIdMapping.id3v2?.description})`,
        );
      } else if (format === "FLAC" || format === "OGG") {
        console.log(
          `  AcoustID Fingerprint → ${acoustidFingerprintMapping.vorbis}`,
        );
        console.log(`  AcoustID ID → ${acoustidIdMapping.vorbis}`);
        console.log(`  MusicBrainz Track ID → ${mbTrackIdMapping.vorbis}`);
      } else if (format === "MP4") {
        console.log(
          `  AcoustID Fingerprint → ${acoustidFingerprintMapping.mp4}`,
        );
        console.log(`  AcoustID ID → ${acoustidIdMapping.mp4}`);
        console.log(`  MusicBrainz Track ID → ${mbTrackIdMapping.mp4}`);
      }

      // Note: The actual implementation would require C++ support for PropertyMap
      console.log(
        `\n⚠️  Note: Advanced metadata writing requires PropertyMap implementation in C++`,
      );

      file.dispose();
    }

    console.log("\n" + "=".repeat(50));
    console.log("🎯 Key Benefits of Format-Agnostic Metadata:");
    console.log("• Single API call works across all formats");
    console.log("• Automatic mapping to format-specific storage");
    console.log("• No need to know ID3 frame names, Vorbis field names, etc.");
    console.log("• Consistent behavior regardless of audio format");
    console.log("• Professional-grade metadata handling");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

function showMetadataMappingTable() {
  console.log("\n" + "=".repeat(50));
  console.log("📊 Complete Metadata Mapping Reference");
  console.log("=".repeat(50));

  console.log("\n🎯 AcoustID Fields:");
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
    "│ Fingerprint     │ TXXX:Acoustid Fingerprint           │ ACOUSTID_FINGERPRINT│ ----:com.apple.iTunes:Acoustid...   │",
  );
  console.log(
    "│ AcoustID        │ TXXX:Acoustid Id                    │ ACOUSTID_ID         │ ----:com.apple.iTunes:Acoustid Id   │",
  );
  console.log(
    "└─────────────────┴──────────────────────────────────────┴─────────────────────┴──────────────────────────────────────┘",
  );

  console.log("\n🎯 MusicBrainz Fields:");
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
    "│ Track ID        │ UFID:http://musicbrainz.org         │ MUSICBRAINZ_TRACKID │ ----:com.apple.iTunes:MusicBrainz...│",
  );
  console.log(
    "│ Release ID      │ TXXX:MusicBrainz Album Id           │ MUSICBRAINZ_ALBUMID │ ----:com.apple.iTunes:MusicBrainz...│",
  );
  console.log(
    "│ Artist ID       │ TXXX:MusicBrainz Artist Id          │ MUSICBRAINZ_ARTISTID│ ----:com.apple.iTunes:MusicBrainz...│",
  );
  console.log(
    "└─────────────────┴──────────────────────────────────────┴─────────────────────┴──────────────────────────────────────┘",
  );

  console.log("\n💡 Usage Example:");
  console.log("```typescript");
  console.log("// This single call works for ALL formats!");
  console.log(
    'file.setProperty(Tags.AcoustidFingerprint, "AQADtMmybfGO8NCNEESLnzHyXNOHeHnG...");',
  );
  console.log("");
  console.log("// Automatically stores as:");
  console.log("// • MP3: TXXX frame with 'Acoustid Fingerprint' description");
  console.log("// • FLAC: ACOUSTID_FINGERPRINT Vorbis comment");
  console.log("// • MP4: ----:com.apple.iTunes:Acoustid Fingerprint atom");
  console.log("");
  console.log("// Or using string property names:");
  console.log('file.setProperty("ACOUSTID_FINGERPRINT", "...");');
  console.log("```");
}

// Run the examples
if (import.meta.main) {
  await demonstrateAdvancedMetadata();
  showMetadataMappingTable();
}
