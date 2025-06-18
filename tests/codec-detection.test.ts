/// <reference lib="deno.ns" />

import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";
import { TagLib } from "../src/mod.ts";
import { join } from "https://deno.land/std@0.220.0/path/mod.ts";

// Test codec detection and lossless detection
Deno.test("codec detection", async (t) => {
  const taglib = await TagLib.initialize();

  await t.step("MP3 - lossy codec", async () => {
    const mp3Path = join("tests", "test-files", "mp3", "kiss-snippet.mp3");
    const mp3Buffer = await Deno.readFile(mp3Path);
    const file = await taglib.open(mp3Buffer);

    try {
      const props = file.audioProperties();
      assertEquals(props?.codec, "MP3");
      assertEquals(props?.isLossless, false);
      assertEquals(props?.bitsPerSample, 0); // MP3 doesn't report bits per sample
    } finally {
      file.save();
      file.dispose();
    }
  });

  await t.step("FLAC - lossless codec", async () => {
    const flacPath = join("tests", "test-files", "flac", "kiss-snippet.flac");
    const flacBuffer = await Deno.readFile(flacPath);
    const file = await taglib.open(flacBuffer);

    try {
      const props = file.audioProperties();
      assertEquals(props?.codec, "FLAC");
      assertEquals(props?.isLossless, true);
      assertEquals(props?.bitsPerSample, 16);
    } finally {
      file.save();
      file.dispose();
    }
  });

  await t.step("WAV - uncompressed PCM", async () => {
    const wavPath = join("tests", "test-files", "wav", "kiss-snippet.wav");
    const wavBuffer = await Deno.readFile(wavPath);
    const file = await taglib.open(wavBuffer);

    try {
      const props = file.audioProperties();
      assertEquals(props?.codec, "PCM");
      assertEquals(props?.isLossless, true);
      assertEquals(props?.bitsPerSample, 16);
    } finally {
      file.save();
      file.dispose();
    }
  });

  await t.step("OGG Vorbis - lossy codec", async () => {
    const oggPath = join("tests", "test-files", "ogg", "kiss-snippet.ogg");
    const oggBuffer = await Deno.readFile(oggPath);
    const file = await taglib.open(oggBuffer);

    try {
      const props = file.audioProperties();
      assertEquals(props?.codec, "Vorbis");
      assertEquals(props?.isLossless, false);
      assertEquals(props?.bitsPerSample, 0); // Vorbis doesn't report bits per sample
    } finally {
      file.save();
      file.dispose();
    }
  });

  await t.step("MP4/M4A - detect AAC vs ALAC", async () => {
    const m4aPath = join("tests", "test-files", "mp4", "kiss-snippet.m4a");
    const m4aBuffer = await Deno.readFile(m4aPath);
    const file = await taglib.open(m4aBuffer);

    try {
      const props = file.audioProperties();
      // The test file is AAC (lossy)
      assertEquals(props?.codec, "AAC");
      assertEquals(props?.isLossless, false);
      // AAC in MP4 typically reports bits per sample
      console.log(`M4A bits per sample: ${props?.bitsPerSample}`);
    } finally {
      file.save();
      file.dispose();
    }
  });

});