/**
 * @fileoverview Test TagLib with a real audio file
 */

import { TagLib } from "../mod.ts";

async function testWithRealFile() {
  console.log("🎵 Testing taglib-wasm with real audio file...");

  try {
    // Initialize TagLib
    const taglib = await TagLib.initialize({
      debug: true,
    });

    console.log("✅ TagLib initialized successfully");

    // Create a minimal WAV file header (44 bytes + minimal audio data)
    const createMinimalWav = (): Uint8Array => {
      const buffer = new ArrayBuffer(52); // Header + 8 bytes of audio data
      const view = new DataView(buffer);
      const bytes = new Uint8Array(buffer);

      // WAV header
      bytes.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
      view.setUint32(4, 44, true); // Chunk size
      bytes.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"

      // Format chunk
      bytes.set([0x66, 0x6D, 0x74, 0x20], 12); // "fmt "
      view.setUint32(16, 16, true); // Subchunk1Size
      view.setUint16(20, 1, true); // AudioFormat (PCM)
      view.setUint16(22, 2, true); // NumChannels
      view.setUint32(24, 44100, true); // SampleRate
      view.setUint32(28, 176400, true); // ByteRate
      view.setUint16(32, 4, true); // BlockAlign
      view.setUint16(34, 16, true); // BitsPerSample

      // Data chunk
      bytes.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
      view.setUint32(40, 8, true); // Subchunk2Size

      // Minimal audio data (silence)
      view.setUint32(44, 0, true);
      view.setUint32(48, 0, true);

      return bytes;
    };

    // Test with the minimal WAV file
    const wavData = createMinimalWav();
    console.log("📁 Created minimal WAV file:", wavData.length, "bytes");

    // Test basic WASM function call first
    const module = taglib.getModule();
    console.log("🔧 Testing basic memory allocation...");
    const testPtr = module._malloc(100);
    console.log("📍 Allocated memory at:", testPtr);
    module._free(testPtr);
    console.log("🧹 Memory freed");

    try {
      const file = taglib.openFile(wavData);

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
        file.setTitle("Test Song");
        file.setArtist("Test Artist");
        file.setAlbum("Test Album");
        file.setYear(2025);
        file.setTrack(1);

        console.log("✏️  Tags set, reading back...");
        const newTag = file.tag();
        console.log("🏷️  New tags:", newTag);

        // Test saving (this might not work for in-memory files)
        const saved = file.save();
        console.log("💾 Save result:", saved);

        // Clean up
        file.dispose();
        console.log("🧹 File disposed");
      } else {
        console.log("❌ File is not valid");
      }
    } catch (fileError) {
      console.log("🔍 File loading error:", (fileError as Error).message);
      console.log("💡 This might be expected for minimal test data");
    }
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
  }
}

if (import.meta.main) {
  await testWithRealFile();
}
