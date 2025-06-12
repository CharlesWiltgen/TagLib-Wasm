/**
 * Test the new Embind-based API
 */

import { assertEquals, assertExists } from "jsr:@std/assert@1";
// @ts-ignore - module format
const createTagLibModule = (await import("../build/taglib.js")).default;
import { createTagLib } from "../src/taglib-embind.ts";

Deno.test("Embind API - Basic functionality", async () => {
  // Load a test file
  const testFile = await Deno.readFile("tests/test-files/test.mp3");
  
  // Create module and TagLib instance
  const module = await createTagLibModule();
  const taglib = await createTagLib(module);
  
  // Open the file
  const file = await taglib.openFile(testFile.buffer);
  
  // Check that we can read basic tags
  const tag = file.tag();
  assertExists(tag);
  
  console.log("Title:", tag.title());
  console.log("Artist:", tag.artist());
  console.log("Album:", tag.album());
  
  // Check audio properties
  const props = file.audioProperties();
  assertExists(props);
  console.log("Duration:", props?.length, "seconds");
  console.log("Bitrate:", props?.bitrate, "kbps");
  console.log("Sample rate:", props?.sampleRate, "Hz");
  
  // Check format
  const format = file.getFormat();
  assertEquals(format, "MP3");
  
  // Test writing
  const originalTitle = tag.title();
  tag.setTitle("Test Title - Embind");
  assertEquals(tag.title(), "Test Title - Embind");
  
  // Restore original
  tag.setTitle(originalTitle);
  
  // Clean up
  file.dispose();
});

Deno.test("Embind API - Property Map", async () => {
  const testFile = await Deno.readFile("tests/test-files/test.mp3");
  
  const module = await createTagLibModule();
  const taglib = await createTagLib(module);
  const file = await taglib.openFile(testFile.buffer);
  
  // Get all properties
  const properties = file.properties();
  assertExists(properties);
  console.log("Properties:", properties);
  
  // Test getting a single property
  const title = file.getProperty("TITLE");
  console.log("Title property:", title);
  
  // Test setting a property
  file.setProperty("CUSTOM", "Test Value");
  assertEquals(file.getProperty("CUSTOM"), "Test Value");
  
  file.dispose();
});

// Run the tests
if (import.meta.main) {
  console.log("Running Embind API tests...");
}