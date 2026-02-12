/// <reference lib="deno.ns" />

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { TagLib } from "../src/mod.ts";
import { join } from "@std/path";

describe("Codec Detection", () => {
  it("MP3 - both container and codec", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const mp3Path = join("tests", "test-files", "mp3", "kiss-snippet.mp3");
    const mp3Buffer = await Deno.readFile(mp3Path);
    const file = await taglib.open(mp3Buffer);

    try {
      const props = file.audioProperties();
      assertEquals(props?.containerFormat, "MP3");
      assertEquals(props?.codec, "MP3");
      assertEquals(props?.isLossless, false);
      assertEquals(props?.bitsPerSample, 0);
    } finally {
      file.save();
      file.dispose();
    }
  });

  it("FLAC - both container and codec", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const flacPath = join("tests", "test-files", "flac", "kiss-snippet.flac");
    const flacBuffer = await Deno.readFile(flacPath);
    const file = await taglib.open(flacBuffer);

    try {
      const props = file.audioProperties();
      assertEquals(props?.containerFormat, "FLAC");
      assertEquals(props?.codec, "FLAC");
      assertEquals(props?.isLossless, true);
      assertEquals(props?.bitsPerSample, 16);
    } finally {
      file.save();
      file.dispose();
    }
  });

  it("WAV container - uncompressed PCM codec", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const wavPath = join("tests", "test-files", "wav", "kiss-snippet.wav");
    const wavBuffer = await Deno.readFile(wavPath);
    const file = await taglib.open(wavBuffer);

    try {
      const props = file.audioProperties();
      assertEquals(props?.containerFormat, "WAV");
      assertEquals(props?.codec, "PCM");
      assertEquals(props?.isLossless, true);
      assertEquals(props?.bitsPerSample, 16);
    } finally {
      file.save();
      file.dispose();
    }
  });

  it("OGG container - Vorbis codec", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const oggPath = join("tests", "test-files", "ogg", "kiss-snippet.ogg");
    const oggBuffer = await Deno.readFile(oggPath);
    const file = await taglib.open(oggBuffer);

    try {
      const props = file.audioProperties();
      assertEquals(props?.containerFormat, "OGG");
      assertEquals(props?.codec, "Vorbis");
      assertEquals(props?.isLossless, false);
      assertEquals(props?.bitsPerSample, 0);
    } finally {
      file.save();
      file.dispose();
    }
  });

  it("MP4 container (M4A file) - AAC codec", async () => {
    const taglib = await TagLib.initialize({ forceBufferMode: true });
    const m4aPath = join("tests", "test-files", "mp4", "kiss-snippet.m4a");
    const m4aBuffer = await Deno.readFile(m4aPath);
    const file = await taglib.open(m4aBuffer);

    try {
      const props = file.audioProperties();
      assertEquals(props?.containerFormat, "MP4");
      assertEquals(props?.codec, "AAC");
      assertEquals(props?.isLossless, false);
      console.log(`M4A bits per sample: ${props?.bitsPerSample}`);
    } finally {
      file.save();
      file.dispose();
    }
  });
});
