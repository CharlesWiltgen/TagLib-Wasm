/**
 * @fileoverview Basic usage example for Deno
 */

// For local development:
import { TagLib } from "../../index.ts";

// When using the published package from JSR:
// import { TagLib } from "@charlesw/taglib-wasm";

async function main() {
  console.log("🎵 TagLib-Wasm Deno Example");

  try {
    // Initialize TagLib
    const taglib = await TagLib.initialize({
      debug: true,
    });

    console.log("✅ TagLib initialized successfully");

    // Example: Load an audio file (you'll need to provide your own file)
    // const file = await taglib.open("path/to/your/audio/file.mp3");

    // if (file.isValid()) {
    //   console.log("📁 File loaded successfully");
    //
    //   // Read metadata
    //   const tag = file.tag();
    //   console.log("🏷️  Tags:", tag);
    //
    //   // Read audio properties
    //   const props = file.audioProperties();
    //   console.log("🎧 Properties:", props);
    //
    //   // Modify metadata
    //   file.setTitle("New Title");
    //   file.setArtist("New Artist");
    //
    //   // Save changes
    //   if (file.save()) {
    //     console.log("💾 File saved successfully");
    //   }
    //
    //   // Clean up
    //   file.dispose();
    // }
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.log(
      "📝 Note: Make sure to build the Wasm module first with 'deno task build:wasm'",
    );
  }
}

if (import.meta.main) {
  await main();
}
