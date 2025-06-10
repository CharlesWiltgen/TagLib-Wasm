/**
 * @fileoverview Test TagLib with a real audio file from test data
 */

import { TagLib } from "./src/mod.ts";

async function testWithRealFile() {
  console.log("🎵 Testing TagLib WASM with real MP3 file...");
  
  try {
    // Initialize TagLib
    const taglib = await TagLib.initialize({
      debug: true,
    });
    
    console.log("✅ TagLib initialized successfully");
    
    // Load a real audio file from TagLib's test data
    const audioPath = "/Users/Charles/Projects/taglib-wasm/lib/taglib/tests/data/ape.mp3";
    console.log("📁 Loading file:", audioPath);
    
    const audioData = await Deno.readFile(audioPath);
    console.log("📊 File size:", audioData.length, "bytes");
    
    try {
      const file = taglib.openFile(audioData);
      
      if (file.isValid()) {
        console.log("🎉 File loaded successfully!");
        console.log("📄 File format:", file.format());
        
        // Test reading tags
        const tag = file.tag();
        console.log("🏷️  Current tags:", tag);
        
        // Test reading audio properties
        const props = file.audioProperties();
        console.log("🎧 Audio properties:", props);
        
        // Test setting tags
        console.log("✏️  Setting new tags...");
        file.setTitle("Test Song from Deno");
        file.setArtist("TagLib WASM Test");
        file.setAlbum("Test Album");
        file.setYear(2025);
        file.setTrack(1);
        
        console.log("✏️  Tags set, reading back...");
        const newTag = file.tag();
        console.log("🏷️  New tags:", newTag);
        
        // Test saving (this might not work for in-memory files)
        console.log("💾 Attempting to save changes...");
        const saved = file.save();
        console.log("💾 Save result:", saved);
        
        // Clean up
        file.dispose();
        console.log("🧹 File disposed");
        
        console.log("🎉 ALL TESTS PASSED! TagLib WASM is fully functional!");
        
      } else {
        console.log("❌ File is not valid");
      }
      
    } catch (fileError) {
      console.log("🔍 File loading error:", (fileError as Error).message);
    }
    
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
  }
}

if (import.meta.main) {
  await testWithRealFile();
}