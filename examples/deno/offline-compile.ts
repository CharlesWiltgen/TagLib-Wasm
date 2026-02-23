#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Example: Using TagLib-Wasm in Deno compiled binaries with offline support
 *
 * This example shows how to embed the WASM file for offline usage in compiled binaries.
 *
 * To prepare and compile:
 * 1. First, copy the WASM file: deno run --allow-read --allow-write prepare-offline.ts
 * 2. Compile with embedded WASM: deno compile --allow-read --include taglib.wasm offline-compile.ts
 * 3. Run the compiled binary: ./offline-compile song.mp3
 */

import { initializeForDenoCompile, readTags } from "@charlesw/taglib-wasm";

async function main() {
  const args = Deno.args;
  if (args.length === 0) {
    console.log("Usage: offline-compile <audio-file>");
    Deno.exit(1);
  }

  const filePath = args[0];

  try {
    // Initialize TagLib with automatic offline support
    // In compiled binaries, this will use the embedded WASM
    // In development, this will fetch from the network
    console.log("Initializing TagLib...");
    const taglib = await initializeForDenoCompile();

    // Read the audio file
    const audioData = await Deno.readFile(filePath);

    // Read tags
    const tags = await readTags(audioData);

    console.log("\nFile:", filePath);
    console.log("Title:", tags.title || "(no title)");
    console.log("Artist:", tags.artist || "(no artist)");
    console.log("Album:", tags.album || "(no album)");
    console.log("Year:", tags.year || "(no year)");
    console.log("Genre:", tags.genre || "(no genre)");
    console.log("Track:", tags.track || "(no track)");

    // Read audio properties
    const file = await taglib.open(audioData);
    const props = file.audioProperties();

    console.log("\nAudio Properties:");
    console.log("Duration:", props.length, "seconds");
    console.log("Bitrate:", props.bitrate, "kbps");
    console.log("Sample Rate:", props.sampleRate, "Hz");
    console.log("Channels:", props.channels);

    file.dispose();
  } catch (error) {
    console.error("Error:", error.message);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
