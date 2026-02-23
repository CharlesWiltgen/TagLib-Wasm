#!/usr/bin/env -S deno run --allow-read

/**
 * Enhanced Property Constants Usage Example
 *
 * This example demonstrates the new PROPERTIES system with rich metadata
 * and type-safe property access with full IDE autocomplete support.
 */

import {
  getAllPropertyKeys,
  getPropertiesByFormat,
  getPropertyMetadata,
  isValidProperty,
  PROPERTIES,
  PropertyKey,
  TagLib,
  Tags,
} from "../../index.ts";

async function demonstrateEnhancedProperties() {
  console.log("🎵 TagLib-Wasm - Enhanced Property System Example");
  console.log("=".repeat(50));

  try {
    // Initialize TagLib
    const taglib = await TagLib.initialize();

    // Load a test file
    const file = await taglib.open(
      "./tests/test-files/mp3/kiss-snippet.mp3",
    );

    if (!file.isValid()) {
      throw new Error("Failed to load audio file");
    }

    console.log("\n🎯 Type-Safe Property Access with PROPERTIES:");
    console.log("=".repeat(50));

    // NEW: Using typed property methods with PROPERTIES constants
    console.log(`Title: ${file.getProperty("TITLE") || "(none)"}`);
    console.log(`Artist: ${file.getProperty("ARTIST") || "(none)"}`);
    console.log(`Album: ${file.getProperty("ALBUM") || "(none)"}`);
    console.log(`Album Artist: ${file.getProperty("ALBUMARTIST") || "(none)"}`);
    console.log(`Composer: ${file.getProperty("COMPOSER") || "(none)"}`);

    console.log("\n📊 Rich Property Metadata:");
    console.log("=".repeat(50));

    // NEW: Access rich metadata for properties
    const titleMeta = getPropertyMetadata("TITLE");
    console.log(`Title Property:`);
    console.log(`  Description: ${titleMeta.description}`);
    console.log(`  Type: ${titleMeta.type}`);
    console.log(
      `  Supported Formats: ${titleMeta.supportedFormats.join(", ")}`,
    );
    console.log(`  ID3v2 Frame: ${titleMeta.mappings.id3v2?.frame}`);
    console.log(`  MP4 Atom: ${titleMeta.mappings.mp4}`);

    const mbidMeta = getPropertyMetadata("MUSICBRAINZ_TRACKID");
    console.log(`\nMusicBrainz Track ID Property:`);
    console.log(`  Description: ${mbidMeta.description}`);
    console.log(`  Type: ${mbidMeta.type}`);
    console.log(`  Supported Formats: ${mbidMeta.supportedFormats.join(", ")}`);

    console.log("\n✏️  Type-Safe Property Setting:");
    console.log("=".repeat(50));

    // NEW: Type-safe property setting with PROPERTIES constants
    file.setProperty("TITLE", "Enhanced Title Example");
    file.setProperty("ARTIST", "Enhanced Artist");
    file.setProperty("ALBUMARTIST", "Enhanced Album Artist");
    file.setProperty(
      "MUSICBRAINZ_TRACKID",
      "123e4567-e89b-12d3-a456-426614174000",
    );
    file.setProperty("REPLAYGAIN_TRACK_GAIN", "-6.54 dB");

    // Verify the changes with typed access
    console.log(`Updated Title: ${file.getProperty("TITLE")}`);
    console.log(`Updated Artist: ${file.getProperty("ARTIST")}`);
    console.log(`Updated Album Artist: ${file.getProperty("ALBUMARTIST")}`);
    console.log(
      `Updated MusicBrainz ID: ${file.getProperty("MUSICBRAINZ_TRACKID")}`,
    );
    console.log(
      `Updated ReplayGain: ${file.getProperty("REPLAYGAIN_TRACK_GAIN")}`,
    );

    console.log("\n🔍 Property Validation and Discovery:");
    console.log("=".repeat(50));

    // NEW: Enhanced property validation
    const validProperty: PropertyKey = "TITLE";
    const invalidProperty = "INVALID_PROPERTY_NAME";

    console.log(
      `Is "${validProperty}" a valid property? ${
        isValidProperty(validProperty)
      }`,
    );
    console.log(
      `Is "${invalidProperty}" a valid property? ${
        isValidProperty(invalidProperty)
      }`,
    );

    // NEW: Format-specific property filtering
    console.log("\n📋 Properties by Format:");
    console.log("=".repeat(50));

    const id3v2Props = getPropertiesByFormat("ID3v2");
    const mp4Props = getPropertiesByFormat("MP4");
    const vorbisProps = getPropertiesByFormat("Vorbis");

    console.log(`ID3v2 supported properties: ${id3v2Props.length}`);
    console.log(`MP4 supported properties: ${mp4Props.length}`);
    console.log(`Vorbis supported properties: ${vorbisProps.length}`);

    console.log(
      `\nFirst 5 ID3v2 properties: ${id3v2Props.slice(0, 5).join(", ")}`,
    );

    // NEW: Property discovery
    console.log("\n📑 Property System Overview:");
    console.log("=".repeat(50));
    const allPropertyKeys = getAllPropertyKeys();
    console.log(`Total properties available: ${allPropertyKeys.length}`);
    console.log("Sample properties with metadata:");

    // Show a few properties with their metadata
    const sampleProps: PropertyKey[] = [
      "TITLE",
      "ALBUMARTIST",
      "MUSICBRAINZ_TRACKID",
      "REPLAYGAIN_TRACK_GAIN",
    ];
    for (const prop of sampleProps) {
      const meta = PROPERTIES[prop];
      console.log(`  ${prop}: ${meta.description} (${meta.type})`);
    }

    console.log("\n🔄 Backward Compatibility:");
    console.log("=".repeat(50));

    // Show that legacy Tags constants still work
    console.log("Legacy Tags constants still supported:");
    console.log(`Tags.Title = "${Tags.Title}"`);
    console.log(`Tags.AlbumArtist = "${Tags.AlbumArtist}"`);
    console.log("But PROPERTIES provide much richer functionality!");

    // Clean up
    file.dispose();
    console.log(
      "\n✅ Enhanced property system example completed successfully!",
    );
  } catch (error) {
    console.error(
      "❌ Error:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Run the example
if (import.meta.main) {
  await demonstrateEnhancedProperties();
}
