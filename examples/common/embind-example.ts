/**
 * Example demonstrating the new Embind-based API
 *
 * This shows how to use the cleaner, more intuitive API that Embind provides
 * compared to the previous C-style wrapper.
 */

import createTagLibModule from "../../build/taglib-wrapper.js";

async function main() {
  console.log("=== TagLib-Wasm Embind Example ===\n");

  // Load the WebAssembly module
  console.log("Loading TagLib module...");
  const module = await createTagLibModule();

  // Load an MP3 file
  const response = await fetch("../tests/test-files/mp3/kiss-snippet.mp3");
  const buffer = await response.arrayBuffer();
  console.log(`Loaded MP3 file: ${buffer.byteLength} bytes\n`);

  // Create a file handle - this is the main entry point
  const fileHandle = module.createFileHandle();

  // Convert ArrayBuffer to binary string (required for Embind)
  const uint8Array = new Uint8Array(buffer);
  const binaryString = Array.from(
    uint8Array,
    (byte) => String.fromCharCode(byte),
  ).join("");

  // Load the file from buffer
  const loaded = fileHandle.loadFromBuffer(binaryString);
  if (!loaded) {
    console.error("Failed to load file!");
    return;
  }

  console.log(`File loaded successfully: ${fileHandle.isValid()}`);
  console.log(`Format: ${fileHandle.getFormat()}\n`);

  // Get and display tag information
  const tag = fileHandle.getTag();
  if (tag) {
    console.log("=== Tag Information ===");
    console.log(`Title: ${tag.title()}`);
    console.log(`Artist: ${tag.artist()}`);
    console.log(`Album: ${tag.album()}`);
    console.log(`Year: ${tag.year()}`);
    console.log(`Track: ${tag.track()}`);
    console.log(`Genre: ${tag.genre()}`);
    console.log(`Comment: ${tag.comment()}\n`);

    // Modify tags
    console.log("=== Modifying Tags ===");
    tag.setTitle("New Title from Embind");
    tag.setArtist("Embind Artist");
    tag.setAlbum("Embind Album");
    tag.setYear(2024);
    tag.setTrack(1);
    tag.setGenre("Electronic");
    tag.setComment("Modified with TagLib-Wasm Embind API");

    console.log(`New Title: ${tag.title()}`);
    console.log(`New Artist: ${tag.artist()}\n`);
  }

  // Get audio properties
  const audioProps = fileHandle.getAudioProperties();
  if (audioProps) {
    console.log("=== Audio Properties ===");
    console.log(`Duration: ${audioProps.lengthInSeconds()} seconds`);
    console.log(`Duration (ms): ${audioProps.lengthInMilliseconds()} ms`);
    console.log(`Bitrate: ${audioProps.bitrate()} kbps`);
    console.log(`Sample rate: ${audioProps.sampleRate()} Hz`);
    console.log(`Channels: ${audioProps.channels()}\n`);
  }

  // Work with properties (format-agnostic metadata)
  console.log("=== Property Map ===");

  // Set custom properties
  fileHandle.setProperty("CUSTOM_FIELD", "Custom Value");
  fileHandle.setProperty("ENCODED_BY", "TagLib-Wasm");

  // Get specific property
  const customValue = fileHandle.getProperty("CUSTOM_FIELD");
  console.log(`Custom Field: ${customValue}`);

  // Get all properties as JavaScript object
  const properties = fileHandle.getProperties();
  console.log("\nAll properties:", properties);

  // MP4-specific features (if applicable)
  if (fileHandle.isMP4()) {
    console.log("\n=== MP4-Specific Features ===");
    fileHandle.setMP4Item("©day", "2024");
    fileHandle.setMP4Item("©too", "TagLib-Wasm Embind");

    const year = fileHandle.getMP4Item("©day");
    const tool = fileHandle.getMP4Item("©too");
    console.log(`Year: ${year}`);
    console.log(`Encoding Tool: ${tool}`);
  }

  // Save changes (would save to buffer in real implementation)
  const saved = fileHandle.save();
  console.log(`\nChanges saved: ${saved}`);

  // Note: With Embind, cleanup is handled automatically by JavaScript's garbage collector
  // No need to manually delete objects

  console.log("\n=== Example Complete ===");
}

// Run the example
if (typeof window === "undefined") {
  // Node.js environment
  main().catch(console.error);
} else {
  // Browser environment
  globalThis.addEventListener("DOMContentLoaded", () => {
    main().catch(console.error);
  });
}
