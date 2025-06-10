/**
 * @fileoverview Systematic test of all audio formats with debug information
 */

import { TagLib } from "./src/mod.ts";

interface TestFile {
  name: string;
  path: string;
  format: string;
  expectedFormat: string;
}

const TEST_FILES: TestFile[] = [
  {
    name: "WAV (simplest format)",
    path: "./test-files/wav/kiss-snippet.wav",
    format: "wav",
    expectedFormat: "WAV"
  },
  {
    name: "MP3 (most common)",
    path: "./test-files/mp3/kiss-snippet.mp3", 
    format: "mp3",
    expectedFormat: "MP3"
  },
  {
    name: "FLAC (lossless)",
    path: "./test-files/flac/kiss-snippet.flac",
    format: "flac", 
    expectedFormat: "FLAC"
  },
  {
    name: "OGG (Vorbis)",
    path: "./test-files/ogg/kiss-snippet.ogg",
    format: "ogg",
    expectedFormat: "OGG"
  },
  {
    name: "M4A (MP4 audio)",
    path: "./test-files/mp4/kiss-snippet.m4a",
    format: "mp4",
    expectedFormat: "MP4"
  }
];

async function testFile(testFile: TestFile, taglib: TagLib): Promise<boolean> {
  console.log(`\n🔍 Testing ${testFile.name}...`);
  console.log(`📁 File: ${testFile.path}`);
  
  try {
    // Check if file exists and get basic info
    const fileStats = await Deno.stat(testFile.path);
    console.log(`📊 Size: ${fileStats.size} bytes`);
    
    // Read file data
    const audioData = await Deno.readFile(testFile.path);
    console.log(`💾 Loaded into memory: ${audioData.length} bytes`);
    
    // Check file header (first 16 bytes)
    const header = Array.from(audioData.slice(0, 16))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    console.log(`🔬 Header: ${header}`);
    
    // Attempt to open with TagLib
    console.log(`🎵 Opening with TagLib...`);
    const file = taglib.openFile(audioData);
    
    if (file.isValid()) {
      console.log(`✅ SUCCESS: File loaded successfully!`);
      
      // Test format detection
      const detectedFormat = file.format();
      console.log(`📄 Detected format: ${detectedFormat}`);
      
      // Test basic properties
      const props = file.audioProperties();
      console.log(`🎧 Audio properties:`, props);
      
      // Test tag reading
      const tags = file.tag();
      console.log(`🏷️  Tags:`, tags);
      
      // Test tag writing
      console.log(`✏️  Testing tag writing...`);
      file.setTitle("Test Title from TagLib WASM");
      file.setArtist("TagLib WASM Test");
      
      const newTags = file.tag();
      console.log(`🏷️  New tags:`, newTags);
      
      // Clean up
      file.dispose();
      console.log(`🧹 File disposed`);
      
      return true;
    } else {
      console.log(`❌ FAILED: File is not valid`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ ERROR: ${(error as Error).message}`);
    console.log(`🔍 Stack trace:`, (error as Error).stack);
    return false;
  }
}

async function runSystematicTests() {
  console.log("🎵 TagLib WASM - Systematic Format Testing");
  console.log("=" .repeat(50));
  
  try {
    // Initialize TagLib
    console.log("🚀 Initializing TagLib WASM...");
    const taglib = await TagLib.initialize({ debug: true });
    console.log("✅ TagLib initialized successfully\n");
    
    // Test basic module functionality
    const module = taglib.getModule();
    console.log("🔧 Testing basic WASM functions...");
    const testPtr = module._malloc(1024);
    console.log(`📍 malloc(1024) = ${testPtr}`);
    module._free(testPtr);
    console.log("🧹 Memory freed successfully");
    
    // Run tests for each format
    const results: { [key: string]: boolean } = {};
    
    for (const testFileConfig of TEST_FILES) {
      const success = await testFile(testFileConfig, taglib);
      results[testFileConfig.format] = success;
    }
    
    // Summary
    console.log("\n" + "=" .repeat(50));
    console.log("📋 Test Results Summary:");
    
    let totalTests = 0;
    let passedTests = 0;
    
    for (const [format, success] of Object.entries(results)) {
      totalTests++;
      if (success) passedTests++;
      
      const status = success ? "✅ PASS" : "❌ FAIL";
      console.log(`${status} ${format.toUpperCase()}`);
    }
    
    console.log(`\n🎯 Overall: ${passedTests}/${totalTests} formats working`);
    
    if (passedTests === totalTests) {
      console.log("🎉 ALL TESTS PASSED! TagLib WASM is fully functional!");
    } else if (passedTests > 0) {
      console.log("⚠️  PARTIAL SUCCESS: Some formats working");
    } else {
      console.log("🔧 DEBUGGING NEEDED: No formats working");
    }
    
  } catch (error) {
    console.error("💥 Fatal error:", (error as Error).message);
    console.error("Stack:", (error as Error).stack);
  }
}

if (import.meta.main) {
  await runSystematicTests();
}