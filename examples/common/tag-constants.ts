#!/usr/bin/env -S deno run --allow-read

/**
 * Tag Constants Usage Example
 *
 * This example demonstrates how to use the Tags constants
 * for type-safe property access with IDE autocomplete.
 */

import { getAllTagNames, isValidTagName, TagLib, Tags } from "../../index.ts";

async function demonstrateTagConstants() {
  console.log("🏷️  taglib-wasm - Tag Constants Example");
  console.log("=".repeat(40));

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

    console.log("\n📋 Using Tag Constants for Type-Safe Access:");
    console.log("=".repeat(40));

    // Get the property map from the file (not the tag)
    const properties = file.properties();

    // Using tag constants (with autocomplete!)
    console.log(`Title: ${properties[Tags.Title]?.[0] || "(none)"}`);
    console.log(`Artist: ${properties[Tags.Artist]?.[0] || "(none)"}`);
    console.log(`Album: ${properties[Tags.Album]?.[0] || "(none)"}`);
    console.log(`Date: ${properties[Tags.Date]?.[0] || "(none)"}`);
    console.log(`Genre: ${properties[Tags.Genre]?.[0] || "(none)"}`);
    console.log(
      `Track Number: ${properties[Tags.TrackNumber]?.[0] || "(none)"}`,
    );

    // Extended properties
    console.log("\n📋 Extended Properties:");
    console.log("=".repeat(40));
    console.log(
      `Album Artist: ${properties[Tags.AlbumArtist]?.[0] || "(none)"}`,
    );
    console.log(`Composer: ${properties[Tags.Composer]?.[0] || "(none)"}`);
    console.log(`BPM: ${properties[Tags.Bpm]?.[0] || "(none)"}`);
    console.log(`Copyright: ${properties[Tags.Copyright]?.[0] || "(none)"}`);

    // Setting properties with constants
    console.log("\n✏️  Setting Properties with Constants:");
    console.log("=".repeat(40));

    const newProperties: Record<string, string[]> = {};
    newProperties[Tags.Title] = ["Song Title Using Constants"];
    newProperties[Tags.Artist] = ["Artist Name"];
    newProperties[Tags.AlbumArtist] = ["Album Artist Name"];
    newProperties[Tags.Composer] = ["Composer Name"];
    newProperties[Tags.Genre] = ["Electronic"];
    newProperties[Tags.Bpm] = ["128"];

    file.setProperties(newProperties);

    // Verify the changes
    const updatedProperties = file.properties();
    console.log(`Updated Title: ${updatedProperties[Tags.Title]?.[0]}`);
    console.log(`Updated Artist: ${updatedProperties[Tags.Artist]?.[0]}`);
    console.log(
      `Updated Album Artist: ${updatedProperties[Tags.AlbumArtist]?.[0]}`,
    );
    console.log(`Updated BPM: ${updatedProperties[Tags.Bpm]?.[0]}`);

    // Demonstrate tag validation
    console.log("\n🔍 Tag Validation:");
    console.log("=".repeat(40));

    const validTag = "TITLE";
    const invalidTag = "INVALID_TAG_NAME";

    console.log(`Is "${validTag}" a valid tag? ${isValidTagName(validTag)}`);
    console.log(
      `Is "${invalidTag}" a valid tag? ${isValidTagName(invalidTag)}`,
    );

    // List all available tags
    console.log("\n📑 All Available Tag Constants:");
    console.log("=".repeat(40));
    const allTags = getAllTagNames();
    console.log(`Total tags available: ${allTags.length}`);
    console.log("First 10 tags:", allTags.slice(0, 10).join(", "));

    // Show how constants map to actual property names
    console.log("\n🔗 Constant to Property Name Mapping:");
    console.log("=".repeat(40));
    console.log(`Tags.Title → "${Tags.Title}"`);
    console.log(`Tags.AlbumArtist → "${Tags.AlbumArtist}"`);
    console.log(`Tags.TrackGain → "${Tags.TrackGain}"`);
    console.log(`Tags.MusicBrainzArtistId → "${Tags.MusicBrainzArtistId}"`);

    // Clean up
    file.dispose();
    console.log("\n✅ Example completed successfully!");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

// Run the example
if (import.meta.main) {
  await demonstrateTagConstants();
}
